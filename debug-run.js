const Mocha = require('mocha');
const path = require('path');

(async () => {
  try {
    const mocha = new Mocha({ timeout: 30000, reporter: 'spec' });
    const testFile = path.resolve(process.cwd(), 'test1.js');
    console.log('DEBUG: running test file ->', testFile);
    mocha.addFile(testFile);

    mocha.run((failures) => {
      console.log('DEBUG: mocha finished. failures =', failures);
      process.exit(failures ? 1 : 0);
    });
  } catch (err) {
    console.error('DEBUG: runner fatal error:', err);
    process.exit(1);
  }
})();
