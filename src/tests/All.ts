
import { error , log} from "../utils/Logging"
import {testSimple} from "./TestSimple"
import {testCopyFieldToHost1D} from "./TestCopyFieldToHost1D"
import {test2DField} from "./Test2DField"
import {testLocalVar} from "./testLocalVar"
import {testVector} from "./TestVector"
import {testMatrix} from "./TestMatrix"
import {testVectorLocalVar} from "./TestVectorLocalVar"
import {testMatrixLocalVar} from "./TestMatrixLocalVar"
import {testMultipleSNodeTree} from "./TestMultipleSNodeTree"
import {testNdrange} from "./TestNdrange"
import {testVectorArithmetic} from "./TestVectorArithmetic"
import {testFloat} from "./TestFloat"
import {testSerial} from "./TestSerial"
import {testMath} from "./TestMath"

async function runAllTests() {
    let passed = true
    passed &&= await testSimple()
    passed &&= await testCopyFieldToHost1D()
    passed &&= await test2DField()
    passed &&= await testLocalVar()
    passed &&= await testVector()
    passed &&= await testMatrix()
    passed &&= await testVectorLocalVar()
    passed &&= await testMatrixLocalVar()
    passed &&= await testMultipleSNodeTree()
    passed &&= await testNdrange()
    passed &&= await testVectorArithmetic()
    passed &&= await testFloat()
    passed &&= await testSerial()
    passed &&= await testMath()

    if(passed){
        console.log("All tests passed")
    }
    else{
        error("TESTS FAILED")
    }
}


export {runAllTests}