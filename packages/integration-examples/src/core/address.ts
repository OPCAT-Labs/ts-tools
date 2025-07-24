import type { SupportedNetwork } from "@opcat-labs/scrypt-ts-opcat";
import { Address, fromSupportedNetwork } from "@opcat-labs/scrypt-ts-opcat";

export function checkAddressValid(address: string, network: SupportedNetwork) {
    try {
        const addr = new Address(address, fromSupportedNetwork(network));
        return addr.toString() === address;
    } catch (error) {
        return false;
    }
}