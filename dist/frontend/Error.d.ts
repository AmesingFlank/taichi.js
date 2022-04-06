declare class ResultOrError<T> {
    isError: boolean;
    result: T | null;
    errorMessage: string | null;
    private constructor();
    static createResult<Y>(result: Y): ResultOrError<Y>;
    static createError<Y>(msg: string): ResultOrError<Y>;
}
export { ResultOrError };
