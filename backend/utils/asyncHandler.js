// Wraps an async route/controller so rejected promises are forwarded to Express's error handler
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
