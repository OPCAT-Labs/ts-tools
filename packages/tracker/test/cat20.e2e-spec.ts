
const privateKeyWif = process.env.TEST_PRIVATE_KEY_WIF as string;
if (!privateKeyWif) {
  throw new Error('TEST_PRIVATE_KEY_WIF is not set');
}

describe('Test CAT20 tracking', () => {
    beforeAll(async () => {
        await sendCAT20Transactions();
    });

    afterAll(async () => {});

    it('should pass', async () => {
        expect(true).toBe(true);
    })
})

async function sendCAT20Transactions() {}


