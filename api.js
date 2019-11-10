const Homey = require('homey');

module.exports = [
  {
    description: 'Show loglines',
    method: 'GET',
    path: '/logs/',
    requires_authorization: true,
    role: 'owner',
    fn: function fn(args, callback) {
      const result = Homey.app.getLogs();
      callback(null, result);
    },
  },
  {
    description: 'Delete logs',
    method: 'DELETE',
    path: '/logs/',
    requires_authorization: true,
    role: 'owner',
    fn: function fn(args, callback) {
      const result = Homey.app.deleteLogs();
      callback(null, result);
    },
  },
];
