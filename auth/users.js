var records = [
    { id: 1, username: 'tim', password: 'ilovemaddy', displayName: 'Tim', icon: 'timicon.png', emails: [ { value: 'tim.carlson@gmail.com' } ] }
  , { id: 2, username: 'maddy', password: 'ilovetim', displayName: 'Maddy', icon: 'maddyicon.png', emails: [ { value: 'mkundel91@gmail.com' } ] }
];

exports.findById = function(id, cb) {
  process.nextTick(function() {
    var idx = id - 1;
    if (records[idx]) {
      cb(null, records[idx]);
    } else {
      cb(new Error('User ' + id + ' does not exist'));
    }
  });
}

exports.findByUsername = function(username, cb) {
  process.nextTick(function() {
    for (var i = 0, len = records.length; i < len; i++) {
      var record = records[i];
      if (record.username === username) {
        return cb(null, record);
      }
    }
    return cb(null, null);
  });
}