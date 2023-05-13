import { assert } from '../../utils/Logging'

class ResultOrError<T> {
    private constructor(public isError: boolean, public result: T | null, public errorMessage: string | null) {
        if (isError) {
            assert(result === null && errorMessage !== null)
        } else {
            assert(result !== null && errorMessage === null)
        }
    }
    public static createResult<Y>(result: Y): ResultOrError<Y> {
        return new ResultOrError<Y>(false, result, null)
    }
    public static createError<Y>(msg: string): ResultOrError<Y> {
        return new ResultOrError<Y>(true, null, msg)
    }
}
export { ResultOrError }
