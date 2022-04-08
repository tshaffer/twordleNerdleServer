import app from './app';

/**
 * Start Express server.
 */
const port = Number(app.get('port'));
const server = app.listen(port, () => {
  console.log(
    '  App is running at http://localhost:%d in %s mode',
    port,
    app.get('env'),
  );
  console.log('  Press CTRL-C to stop\n');
});

// Handle unhandled promise rejection
process.on('unhandledRejection', (err: any, promise: any) => {
  console.log(`Error: ${err.message}`);
  // Close server and exit process
  server.close(() => process.exit(1));
});

export default server;
