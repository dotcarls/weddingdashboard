const http         = require('http'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env,
      express      = require('express'),
      passport     = require('passport'),
      Strategy     = require('passport-local').Strategy,
      auth         = require('./auth'),
      session      = require('express-session'),
      MongoStore   = require('connect-mongo')(session),
      Parse        = require('node-parse-api').Parse,
      _            = require('lodash'),
      moment       = require('moment'),
      mongoose     = require('mongoose');

var options = {
  app_id: ***REMOVED***,
  api_key: ***REMOVED***
};

var parse = new Parse(options);

passport.use(new Strategy(
  function(username, password, cb) {
    auth.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  })
);

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  auth.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

var connection_string = '127.0.0.1:27017/weddingdashboard';
// if OPENSHIFT env variables are present, use the available connection info:
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
  connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
  process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
  process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
  process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
  process.env.OPENSHIFT_APP_NAME;
}

mongoose.connect('mongodb://' + connection_string);

const ChatMessage = mongoose.model('ChatMessage', {
  user: Object,
  timestamp: Date, 
  message: String
});

const Todo = mongoose.model('Todo', {
  timestamp: Date,
  message: String,
  completed: Boolean
});

const app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(session({resave: false, saveUninitialized: false, secret: 'timnmaddy', store: new MongoStore({mongooseConnection: mongoose.connection})}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

app.get('/health', function(req, res) {
  res.status(200).send(200);
});

app.get('/', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  var data = {};
  data.individualCount = 0;
  data.attending = 0;
  data.total = 0;
  data.notAttending = 0;
  data.foodCounts = {};
  data.foodCounts["schnitzel"] = 0;
  data.foodCounts["fish"] = 0;
  data.foodCounts["chicken"] = 0;
  data.updatedDates = {};
  data.createdDates = {};
  data.updatedDatesSorted = [];
  data.createdDatesSorted = [];
  data.createdDatesAttendeesCount = {};
  data.createdDatesTotalAttendees = {};
  data.createdDatesTotalRsvps = {};
  data.results = {};
  data.rsvps = {};
  data.notAttendees = {};
  data.attendeesFlat = {};
  data.roomCount = 0;
  data.commentCount = 0;
  data.comments = [];

  parse.find('Rsvp', '', function(err, response) {

    if (err) {
      // console.log("#### ERROR ####");
      // console.log(err);
    } else {
      // console.log("Success!");
      data.results = response.results;

      
      // console.log(JSON.stringify(response));
      
      // console.log("Processing " + response.results.length + " records.");
      
      response.results.forEach(function(result) {
        data.total++;

        var updatedAt = moment(result.updatedAt).format("M/D/YY");
        var createdAt = moment(result.createdAt).format("M/D/YY");
        _.has(data.updatedDates, updatedAt) ? data.updatedDates[updatedAt] += 1 : data.updatedDates[updatedAt] = 1;
        _.has(data.createdDates, createdAt) ? data.createdDates[createdAt] += 1 : data.createdDates[createdAt] = 1;

        var rsvpName = "RSVP " + data.total;

        if (result.attending) { 
          if (result.attendees[0].firstName !== "")
            rsvpName = result.attendees[0].firstName + " " + result.attendees[0].lastName;

          data.rsvps[rsvpName] = result;

          result.attendees.forEach(function(attendee) {
            data.attendeesFlat[attendee.firstName + " " + attendee.lastName] = attendee;

            if (attendee.food)
              data.foodCounts[attendee.food]++;

            data.individualCount++;
            _.has(data.createdDatesAttendeesCount, createdAt) ? data.createdDatesAttendeesCount[createdAt] += 1 : data.createdDatesAttendeesCount[createdAt] = 1;
          });

          data.attending++;

          if (result.hotel.needsReservation)
            data.roomCount += parseInt(result.hotel.numberOfRooms);
        } else { 
          if (result.notAttendingName)
            rsvpName = result.notAttendingName;
          
          data.notAttendees[rsvpName] = result;
          data.notAttending++;
        }

        if (result.comment) {
          data.commentCount++;
          data.comments.push({rsvpName: rsvpName, comment: result.comment})
        }

        data.createdDatesTotalAttendees[createdAt] = data.individualCount;
        data.createdDatesTotalRsvps[createdAt] = data.total;
      });

      // console.log("Total Attendees: " + data.individualCount);
      // console.log("RSVPs declined: " + data.notAttending);
      // console.log("Rooms needed: " + data.roomCount);

      // console.log("Found " + Object.keys(data.createdDates).length + " unique dates.")
      var topSubmissionsDateCount = 0;
      var topSubmissionsDate = "";

      Object.keys(data.createdDates).forEach(function(date) {
        if (data.createdDates[date] > topSubmissionsDateCount) {
          topSubmissionsDateCount = data.createdDates[date];
          topSubmissionsDate = date;
        }
      });

      // console.log("Most submissions on " + topSubmissionsDate + " with " + topSubmissionsDateCount + " submissions.");
      data.createdDatesSorted = Object.keys(data.createdDates);
      data.createdDatesSorted.sort(function(a, b) {
        var mA = moment(a, "M/D/YY");
        var mB = moment(b, "M/D/YY");

        if (mA.isBefore(mB))
          return -1;
        if (mB.isBefore(mA))
          return 1;
        return 0;       
      }); 
    }
    // console.log(data);
    res.render('home', {user: req.user, data: data});
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), function(req, res) {
  // console.log(req);
  res.redirect('/');
});

app.post('/addComment', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  // console.log(req);
  var message = new ChatMessage({user: req.user, message: req.body.message, timestamp: new Date()});
  message.save(function(err) {
    if (err) 
      res.send(500);
    else
      res.send(200);
  });
});

app.post('/addTodo', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  var todo = new Todo({timestamp: new Date(), completed: false, message: req.body.message});
  todo.save(function(err) {
    if (err)
      res.send(500);
    else
      res.send(200);
  });
});

app.get('/todos', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  Todo.find({}).sort({timestamp: -1}).exec(function(err, todos) {
    if (err) return console.error(err);
    res.json({"todos": todos});
  });
});

app.get('/chatMessages', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  ChatMessage.find({}).sort({timestamp: -1}).limit(25).exec(function(err, messages) {
    if (err) return console.error(err);
    res.json({"messages": messages});
  });
});

app.delete('/todo', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  Todo.remove({_id: req.body.id}, function(err) {
    if (err)
      res.send(500);
    else 
      res.send(200);
  });
});

app.put('/todo', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  Todo.update({_id: req.body.id}, {message: req.body.message, timestamp: new Date()}, function(err) {
    if (err)
      res.send(500);
    else
      res.send(200);
  });
});

app.put('/checkTodo', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  Todo.update({_id: req.body.id}, {completed: req.body.completed}, function(err) {
    if (err)
      res.send(500);
    else
      res.send(200);
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/profile', require('connect-ensure-login').ensureLoggedIn(), function(req, res) {
  res.render('profile', {user: req.user});
});


app.listen(env.NODE_PORT || 3000, env.NODE_IP || 'localhost', function () {
  console.log(`Application worker ${process.pid} started...`);
});
