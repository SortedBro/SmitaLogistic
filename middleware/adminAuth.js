// Middleware: protect admin routes
module.exports = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  req.flash('error', 'Admin login required.');
  res.redirect('/admin/login');
};