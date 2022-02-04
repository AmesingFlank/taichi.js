import {assert, error} from "../utils/Logging"

function assertArrayEqual(actual : number[], expected:number[], epsilon = 1e-6): boolean{
    assert(actual.length === expected.length, "length mismatch")
    for(let i = 0; i< actual.length;++i){
        if(Math.abs(actual[i]-expected[i]) > epsilon){
            error("Mismatch at ",i,actual,expected)
            return false
        }
    }
    return true
}

export {assertArrayEqual}