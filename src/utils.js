function DebugPrint(message, ...args) {
  if (process.env.DEBUG) console.log(`DEBUG :: ${message} : `, ...args);
}

function IsObject(a) {
  return typeof a === 'object' && a !== null;
}

module.exports = {
  DebugPrint,
  IsObject,
};
