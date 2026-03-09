import { expect } from 'chai'

describe('Intentional CI failure to test claude-ci-fix workflow', () => {
    it('should fail on purpose', () => {
        // This test intentionally fails to trigger the Auto Fix CI Failures workflow
        expect(1 + 1).to.equal(3)
    })
})
