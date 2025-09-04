// passenger_wsgi.js

// This MUST be at the very top of the file for Passenger to work.
if (typeof(PhusionPassenger) !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

// Now, simply require the main application.
// We have already proven that server.js works perfectly.
const app = require('./server');

// The listen call must be inside the Passenger check.
if (typeof(PhusionPassenger) !== 'undefined') {
    // This special 'passenger' string tells it to listen on the socket
    // that Passenger provides, regardless of the port number.
    app.listen('passenger', () => {
        console.log(`🚀 Sproutify AI Server started and listening via Phusion Passenger`);
    });
} else {
    // This block is for if you ever run `node passenger_wsgi.js` directly,
    // which you shouldn't normally do.
    console.warn("Not running under Phusion Passenger. For standalone mode, run 'node server.js' instead.");
    // For safety, you could add a fallback listen for testing.
    // const PORT = process.env.PORT || 3001;
    // app.listen(PORT, () => {
    //   console.log(`Fallback listener started on port ${PORT}`);
    // });
}