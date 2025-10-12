// legacy exports
export { burn } from './burn/burn'
export { deploy as deployOpenMinter } from './deploy/openMinter'
export { mint as openMinterMint } from './mint/openMinter'
export { singleSend, singleSendStep1, singleSendStep2, singleSendStep3 } from './send/singleSend'
export { incinerate } from './incinerate'

// new exports, avoid symbol collision
export { deploy as deployOpenMinterToken } from './deploy/openMinter'
export { deploy as deployClosedMinterToken } from './deploy/closedMinter'
export { mint as mintOpenMinterToken } from './mint/openMinter'
export { mint as mintClosedMinterToken } from './mint/closedMinter'
export {burn as burnToken} from './burn/burn'
export {singleSend as singleSendToken, singleSendStep1 as singleSendTokenStep1, singleSendStep2 as singleSendTokenStep2, singleSendStep3 as singleSendTokenStep3} from './send/singleSend'
export {incinerate as incinerateToken} from './incinerate'
