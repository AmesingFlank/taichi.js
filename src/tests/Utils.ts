import { assert, error } from '../utils/Logging'

function assertEqual<T>(actual: any, expected: any, epsilon = 1e-6): boolean {
    if (typeof expected === 'number') {
        assert(typeof actual === 'number', 'expecting number')
        if (isNaN(actual) != isNaN(expected) || Math.abs(actual - expected) > epsilon) {
            error(`Mismatch: expecting ${expected}, but received ${actual}`)
            return false
        }
        return true
    } else if (Array.isArray(expected)) {
        assert(Array.isArray(actual), 'expecting array')
        assert(actual.length === expected.length, 'length mismatch ', actual.length, expected.length)
        for (let i = 0; i < actual.length; ++i) {
            if (!assertEqual(actual[i], expected[i], epsilon)) {
                return false
            }
        }
        return true
    } else {
        let keysActual = Object.keys(actual)
        let keysExpected = Object.keys(expected)
        assert(
            keysActual.length === keysExpected.length,
            "number of properties don't match",
            keysActual.length,
            keysExpected.length
        )
        for (let i = 0; i < keysActual.length; ++i) {
            assert(
                keysActual[i] === keysExpected[i],
                `key number ${i} don't match: ${keysActual[i]}, ${keysExpected[i]}`
            )
            let key = keysActual[i]
            if (!assertEqual(actual[key], expected[key], epsilon)) {
                return false
            }
        }
        return true
    }
}

export { assertEqual }
