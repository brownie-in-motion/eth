import { defaultAbiCoder as AbiCoder } from '@ethersproject/abi'
import { Address } from '@ethereumjs/util'
import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EEI } from '@ethereumjs/vm'
import { EVM } from '@ethereumjs/evm'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import solc from 'solc';
import fs from 'fs';

const shadowedContract = 'BaseRegistrarImplementation';

const input = {
  language: 'Solidity',
  sources: {
    'viewer.sol': {
      content: fs.readFileSync('ENS.sol').toString() + `

// File: @ensdomains/ethregistrar/contracts/BaseRegistrarImplementation.sol

pragma solidity ^0.5.0;

contract BaseRegistrarImplementation is BaseRegistrar, ERC721 {
    // A map of expiry times
    mapping(uint256=>uint) expiries;

    bytes4 constant private INTERFACE_META_ID = bytes4(keccak256("supportsInterface(bytes4)"));
    bytes4 constant private ERC721_ID = bytes4(
        keccak256("balanceOf(address)") ^
        keccak256("ownerOf(uint256)") ^
        keccak256("approve(address,uint256)") ^
        keccak256("getApproved(uint256)") ^
        keccak256("setApprovalForAll(address,bool)") ^
        keccak256("isApprovedForAll(address,address)") ^
        keccak256("transferFrom(address,address,uint256)") ^
        keccak256("safeTransferFrom(address,address,uint256)") ^
        keccak256("safeTransferFrom(address,address,uint256,bytes)")
    );
    bytes4 constant private RECLAIM_ID = bytes4(keccak256("reclaim(uint256,address)"));

    constructor(ENS _ens, bytes32 _baseNode) public {
        ens = _ens;
        baseNode = _baseNode;
    }

    modifier live {
        require(ens.owner(baseNode) == address(this));
        _;
    }

    modifier onlyController {
        require(controllers[msg.sender]);
        _;
    }

    /**
     * @dev Gets the owner of the specified token ID. Names become unowned
     *      when their registration expires.
     * @param tokenId uint256 ID of the token to query the owner of
     * @return address currently marked as the owner of the given token ID
     */
    function ownerOf(uint256 tokenId) public view returns (address) {
        require(expiries[tokenId] > now);
        return super.ownerOf(tokenId);
    }

    // Authorises a controller, who can register and renew domains.
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
        emit ControllerAdded(controller);
    }

    // Revoke controller permission for an address.
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
        emit ControllerRemoved(controller);
    }

    // Set the resolver for the TLD this registrar manages.
    function setResolver(address resolver) external onlyOwner {
        ens.setResolver(baseNode, resolver);
    }

    // Returns the expiration timestamp of the specified id.
    function nameExpires(uint256 id) external view returns(uint) {
        return expiries[id];
    }

    // Returns true iff the specified name is available for registration.
    function available(uint256 id) public view returns(bool) {
        // Not available if it's registered here or in its grace period.
        return expiries[id] + GRACE_PERIOD < now;
    }

    /**
     * @dev Register a name.
     * @param id The token ID (keccak256 of the label).
     * @param owner The address that should own the registration.
     * @param duration Duration in seconds for the registration.
     */
    function register(uint256 id, address owner, uint duration) external returns(uint) {
      return _register(id, owner, duration, true);
    }

    /**
     * @dev Register a name, without modifying the registry.
     * @param id The token ID (keccak256 of the label).
     * @param owner The address that should own the registration.
     * @param duration Duration in seconds for the registration.
     */
    function registerOnly(uint256 id, address owner, uint duration) external returns(uint) {
      return _register(id, owner, duration, false);
    }

    function _register(uint256 id, address owner, uint duration, bool updateRegistry) internal live onlyController returns(uint) {
        require(available(id));
        require(now + duration + GRACE_PERIOD > now + GRACE_PERIOD); // Prevent future overflow

        expiries[id] = now + duration;
        if(_exists(id)) {
            // Name was previously owned, and expired
            _burn(id);
        }
        _mint(owner, id);
        if(updateRegistry) {
            ens.setSubnodeOwner(baseNode, bytes32(id), owner);
        }

        emit NameRegistered(id, owner, now + duration);

        return now + duration;
    }

    function renew(uint256 id, uint duration) external live onlyController returns(uint) {
        require(expiries[id] + GRACE_PERIOD >= now); // Name must be registered here or in grace period
        require(expiries[id] + duration + GRACE_PERIOD > duration + GRACE_PERIOD); // Prevent future overflow

        expiries[id] += duration;
        emit NameRenewed(id, expiries[id]);
        return expiries[id];
    }

    /**
     * @dev Reclaim ownership of a name in ENS, if you own it in the registrar.
     */
    function reclaim(uint256 id, address owner) external live {
        require(_isApprovedOrOwner(msg.sender, id));
        ens.setSubnodeOwner(baseNode, bytes32(id), owner);
    }

    function supportsInterface(bytes4 interfaceID) external view returns (bool) {
        return interfaceID == INTERFACE_META_ID ||
               interfaceID == ERC721_ID ||
               interfaceID == RECLAIM_ID;
    }

    // test: ENS view owner for kuilin.eth
    function _injected() public view returns (address) {
        return super.ownerOf(42080392103428008116835551863617413589103124594961911059876845066174634674511);
    }
}

      `
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

const compile = input => {
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (!output.contracts || !output.contracts['viewer.sol']) {
    console.log("sol compile fail");
    console.log(output);
    process.exit(1);
  }

  const code = output.contracts['viewer.sol'][shadowedContract].evm.deployedBytecode.object;
  if (!code.length) {
    console.log("sol compile empty");
    console.log(output);
    process.exit(1);
  }

  return code;
};
compile(input);

const main = async () => {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
  const stateManager = new DefaultStateManager()
  const blockchain = await Blockchain.create()
  const eei_orig = new EEI(stateManager, common, blockchain)
  
  // proxy eei
  const log = (name, args, ret) => {
    console.log("======");
    console.log(name + "(");
    for (let arg of args) console.log(arg);
    console.log(") =>", ret);
  };
  const eei = new Proxy(eei_orig,  {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof val !== "function") return val;

      return new Proxy(val, {
        apply(target, thisArg, argumentsList) {
          const ret = target.apply(thisArg, argumentsList);
          if (ret instanceof Promise) {
            return ret.then(pret => {
              log("async " + prop, argumentsList, pret);
              return pret;
            });
          } else {
            log(prop, argumentsList, ret);
            return ret;
          }
        }
      });
    }
  });

  const evm = new EVM({
    common,
    eei,
  })

  const code = compile(input);

  evm.events.on('step', function (data) {
    // Note that data.stack is not immutable, i.e. it is a reference to the vm's internal stack object
    console.log(`Opcode: ${data.opcode.name}\tStack: ${data.stack}`)
  })

  evm
    .runCall({
      to: Address.fromString('0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'),
      data: Buffer.from('2fec1618', 'hex'), // keccak256("_injected()") is 2fec1618
    })
    .then((results) => {
      console.log(results);
    })
    .catch(console.error)
}

void main()
