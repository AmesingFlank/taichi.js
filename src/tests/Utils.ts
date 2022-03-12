import {assert, error} from "../utils/Logging"
import { MultiDimensionalArray } from "../utils/MultiDimensionalArray"

function assertArrayEqual<T>(actual : any[], expected: any[], epsilon = 1e-6): boolean{
    assert(actual.length === expected.length, "length mismatch ",actual.length, expected.length)
    for(let i = 0; i< expected.length;++i){
        if(Array.isArray(expected[i])){
            assert(Array.isArray(actual[i]), "expecting array")
            if(!assertArrayEqual(actual[i], expected[i], epsilon)){
                return false
            }
        }
        else if(typeof expected[i] === "number"){
            assert(typeof actual[i] === "number", "expecting number")
            if(Math.abs(actual[i]-expected[i]) > epsilon){
                error("Mismatch at ",i,actual,expected)
                return false
            }
        }
        else{
            error("unsupported")
        }
    }
    return true
}

export {assertArrayEqual}