function DebugPrint(message, ...args) {
  if (process.env.DEBUG) console.log(`DEBUG :: ${message} : `, ...args);
}

function IsObject(a) {
  return typeof a === 'object' && a !== null;
}

const IsIP = new RegExp(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):?([0-9]{1,5})?$/,
);

module.exports = {
  DebugPrint,
  IsObject,
  IsIP,
};
