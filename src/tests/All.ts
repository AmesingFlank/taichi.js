
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
import {testKernelScope} from "./TestKernelScope"
import {testIf} from "./TestIf"
import {testWhile} from "./TestWhile"
import {testBreak} from "./TestBreak"
import {testContinue} from "./TestContinue"
import {testUnary} from "./TestUnary"
import {testArrowFunctionKernel} from "./TestArrowFunctionKernel"
import {testArgs} from "./TestArgs"
import {testFunc} from "./TestFunc"
import {testVectorComponent} from "./TestVectorComponent"
import {testPropertyFunc} from "./TestPropertyFunc"
import {testSwizzle} from "./TestSwizzle"
import {testRandom} from "./TestRandom"


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
    passed &&= await testKernelScope()
    passed &&= await testIf()
    passed &&= await testWhile()
    passed &&= await testBreak()
    passed &&= await testContinue()
    passed &&= await testUnary()
    passed &&= await testArrowFunctionKernel()
    passed &&= await testArgs()
    passed &&= await testFunc()
    passed &&= await testVectorComponent()
    passed &&= await testPropertyFunc()
    passed &&= await testSwizzle()
    passed &&= await testRandom()

    if(passed){
        console.log("All tests passed")
    }
    else{
        error("TESTS FAILED")
    }
}


export {runAllTests}