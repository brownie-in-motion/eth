import { EEI } from '@ethereumjs/vm'
/* import type { EEIInterface } from '@ethereumjs/evm' */ // no typescript lol

// Transparent EEI interface proxy
// For understanding what the EEI _does_

const log = (name, args, ret) => {
  console.log(name + "(", ...args, ") =>", ret);
  return ret;
};

export class CustomEEI extends EEI /* implements EEIInterface */ {
  async getExternalBalance(...args) {
    return log("getExternalBalance", args, await super.getExternalBalance(...args));
  }

  async getExternalCodeSize(...args) {
    return log("getExternalCodeSize", args, await super.getExternalCodeSize(...args));
  }

  async getExternalCode(...args) {
    return log("getExternalCode", args, await super.getExternalCode(...args));
  }

  async getBlockHash(...args) {
    return log("getBlockHash", args, await super.getBlockHash(...args));
  }

  async storageStore(...args) {
    return log("storageStore", args, await super.storageStore(...args));
  }

  async storageLoad(...args) {
    return log("storageLoad", args, await super.storageLoad(...args));
  }

  copy(...args) {
    return log("copy", args, super.copy(...args));
  }
}
