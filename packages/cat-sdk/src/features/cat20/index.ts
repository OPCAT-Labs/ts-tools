export { deployOpenMinterToken } from './deploy/openMinter'
export { deployClosedMinterToken } from './deploy/closedMinter'
export { mintOpenMinterToken } from './mint/openMinter'
export { mintClosedMinterToken } from './mint/closedMinter'
export { burnToken } from './burn/burn'
export {
    singleSend as singleSendToken,
    singleSendStep1 as singleSendTokenStep1,
    singleSendStep2 as singleSendTokenStep2,
    singleSendStep3 as singleSendTokenStep3,
} from './send/singleSend'

// legacy exports
/**
 * @hidden
 */
export { burnToken as burn } from './burn/burn'
/**
 * @hidden
 */
export { deployOpenMinterToken as deployOpenMinter } from './deploy/openMinter'
/**
 * @hidden
 */
export { mintOpenMinterToken as openMinterMint } from './mint/openMinter'
/**
 * @hidden
 */
export { singleSend, singleSendStep1, singleSendStep2, singleSendStep3 } from './send/singleSend'