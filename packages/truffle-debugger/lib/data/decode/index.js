import debugModule from "debug";
const debug = debugModule("debugger:data:decode");

import {BigNumber} from "bignumber.js";

import * as memory from "./memory";
import * as storage from "./storage";
import * as utils from "./utils";
import { WORD_SIZE } from "./utils";


export function decodeValue(definition, bytes, ...args) {
  switch (utils.typeClass(definition)) {
    case "bool":
      return !utils.toBigNumber(bytes).isZero();

    case "uint":
      return utils.toBigNumber(bytes);

    case "int":
      return utils.toSignedBigNumber(bytes);

    case "address":
      return utils.toHexString(bytes, true);

    case "string":
      return String.fromCharCode.apply(null, bytes);

    case "array":
      debug("type %s", utils.typeIdentifier(definition));
      return memory.chunk(bytes, WORD_SIZE)
        .map(
          (chunk) => decode(utils.baseDefinition(definition), chunk, ...args)
        );
      return null;

    default:
      debug("Unknown value type: %s", utils.typeIdentifier(definition));
      return null;
  }
}

export function decodeMemoryReference(definition, pointer, state, ...args) {
  pointer = utils.toBigNumber(pointer).toNumber();

  let rawValue = utils.toBigNumber(
    memory.read(state.memory, pointer) || 0x0
  ).toNumber();

  var bytes;
  switch (utils.typeClass(definition)) {

    case "string":
      bytes = memory.readBytes(
        state.memory, pointer + WORD_SIZE, rawValue /* string length */
      );
      return decodeValue(definition, bytes, state, ...args);

    case "array":
      debug("memory array pointer %s", );
      bytes = memory.readBytes(
        state.memory, pointer + WORD_SIZE, rawValue * WORD_SIZE /* array length */
      );
      return decodeValue(definition, bytes, state, ...args);

    case "struct":
      let [refs] = args;
      let structDefinition = refs[definition.typeName.referencedDeclaration];
      debug("structDefinition %O", structDefinition);
      let structVariables = structDefinition.variables || [];

      return Object.assign(
        {}, ...structVariables
          .map(
            ({name, id}, i) => {
              let memberDefinition = refs[id].definition;
              let memberPointer = memory.read(state.memory, pointer + i * WORD_SIZE);

              // HACK
              memberDefinition = {
                ...memberDefinition,

                typeDescriptions: {
                  ...memberDefinition.typeDescriptions,

                  typeIdentifier:
                    memberDefinition.typeDescriptions.typeIdentifier
                      .replace(/_storage_/g, "_memory_")
                }
              };

              debug("name %s %O", name, memberDefinition);

              return {
                [name]: decode(
                  memberDefinition, memberPointer, state, ...args
                )
              };
            }
          )
      );


    default:
      debug("Unknown memory reference type: %s", utils.typeIdentifier(definition));
      return null;

  }

}

export function decodeStorageReference(definition, pointer, state, ...args) {
  var data;
  var bytes;
  var length;
  var slot;

  switch (utils.typeClass(definition)) {
    case "array":
      debug("storage array!");
      data = storage.read(state.storage, pointer);

      if (!data) {
        return null;
      }

      length = utils.toBigNumber(data);
      slot = [pointer];
      bytes = storage.readBytes(state.storage, slot, length * WORD_SIZE);
      return decodeValue(definition, bytes, state, ...args);

    case "string":
      debug("storage string! %o", pointer);

      data = storage.read(state.storage, pointer);
      if (!data) {
        return null;
      }

      if (data[WORD_SIZE - 1] % 2 == 0) {
        // string lives in word, length is last byte / 2
        length = data[WORD_SIZE - 1] / 2;
        slot = pointer;
      } else {
        length = utils.toBigNumber(data).minus(1).div(2).toNumber();
        slot = [pointer];
      }

      bytes = storage.readBytes(state.storage, slot, length);
      return decodeValue(definition, bytes, state, ...args);

    default:
      debug("Unknown storage reference type: %s", utils.typeIdentifier(definition));
      return undefined;
  }
}



export default function decode(definition, ...args) {
  if (!utils.isReference(definition)) {
    return decodeValue(definition, ...args);
  }

  switch (utils.referenceType(definition)) {
    case "memory":
      return decodeMemoryReference(definition, ...args);
    case "storage":
      return decodeStorageReference(definition, ...args);
    default:
      debug("Unknown reference category: %s", utils.typeIdentifier(definition));
      return undefined;
  }
}

// export default function decode(definition, rawValue, state, refs) {
//   /*
//    * if reference type:
//    *   if memory:
//    *
//    * else if value type:
//    *   decodeValue(definition, valueBytes)
//    */
//   var length;
//   var bytes;

//   debug("definition: %o %o", definition.typeDescriptions, definition.typeName);
//   if (definition.typeName.referencedDeclaration) {
//     debug("referenced %o", refs[definition.typeName.referencedDeclaration]);
//   }

//   let mainType = definition.typeDescriptions.typeIdentifier
//     .match(/(t_[^$_]+)/)[0];

//   switch (mainType) {
//     case "t_string":
//       debug("rawValue: %o", rawValue.toNumber());

//       length = memory.read(state.memory, rawValue);
//       if (length == null) {
//         return null;
//       }
//       debug("length: %o", length);

//       bytes = memory.readBytes(state.memory, rawValue.plus(WORD_SIZE), length);
//       debug("bytes: %o", bytes.length);
//       return String.fromCharCode.apply(null, bytes);

//     default:
//       return rawValue.toNumber();
//   }
// }
