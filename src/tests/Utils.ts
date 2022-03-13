import { assert, error } from "../utils/Logging"
import { MultiDimensionalArray } from "../utils/MultiDimensionalArray"

function assertEqual<T>(actual: any, expected: any, epsilon = 1e-6): boolean {
    if (typeof expected === "number") {
        assert(typeof actual === "number", "expecting number")
        if (Math.abs(actual - expected) > epsilon) {
            error(`Mismatch: expecting ${expected}, but received ${actual}`)
            return false
        }
        return true
    }
    else if (Array.isArray(expected)) {
        assert(Array.isArray(actual), "expecting array")
        assert(actual.length === expected.length, "length mismatch ", actual.length, expected.length)
        for (let i = 0; i < actual.length; ++i) {
            if (!assertEqual(actual[i], expected[i], epsilon)) {
                return false
            }
        }
        return true
    }
    else {
        error("unsupported value in assertEqual")
        return false
    }
}

export { assertEqual }