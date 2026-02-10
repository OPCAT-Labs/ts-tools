export { deployOpenMinterToken } from './deploy/openMinter.js'
export { deployClosedMinterToken } from './deploy/closedMinter.js'
export { mintOpenMinterToken } from './mint/openMinter.js'
export { mintClosedMinterToken } from './mint/closedMinter.js'
export { burnToken } from './burn/burn.js'
export {
    singleSend as singleSendToken,
    singleSendStep1 as singleSendTokenStep1,
    singleSendStep2 as singleSendTokenStep2,
    singleSendStep3 as singleSendTokenStep3,
} from './send/singleSend.js'
export {
    mergeSendToken,
    calculateTokenTransferCount
} from './send/mergeSend.js'
export { burnByAdmin } from './admin/burnByAdmin.js'
export { transferOwnership } from './admin/transferOwnership.js'
export { destroyCAT20Guard } from './guard/destroyGuard.js'

// legacy exports
/**
 * @hidden
 */
export { burnToken as burn } from './burn/burn.js'
/**
 * @hidden
 */
export { deployOpenMinterToken as deployOpenMinter } from './deploy/openMinter.js'
/**
 * @hidden
 */
export { mintOpenMinterToken as openMinterMint } from './mint/openMinter.js'
/**
 * @hidden
 */
export { singleSend, singleSendStep1, singleSendStep2, singleSendStep3 } from './send/singleSend.js'