// Redirect to API
module.exports = (req, res) => {
  res.writeHead(301, { Location: '/api/' });
  res.end();
};