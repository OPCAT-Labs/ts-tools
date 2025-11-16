

describe('Test CAT721 tracking', () => {
    beforeAll(async () => {
        await sendCAT721Transactions();
    });

    afterAll(async () => {});

    it('should pass', async () => {
        expect(true).toBe(true);
    })
})

async function sendCAT721Transactions() {}