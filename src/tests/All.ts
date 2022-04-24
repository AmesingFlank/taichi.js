
import { error } from "../utils/Logging"
import { testSimple } from "./TestSimple"
import { testCopyFieldToHost1D } from "./TestCopyFieldToHost1D"
import { test2DField } from "./Test2DField"
import { testLocalVar } from "./TestLocalVar"
import { testVector } from "./TestVector"
import { testMatrix } from "./TestMatrix"
import { testVectorLocalVar } from "./TestVectorLocalVar"
import { testMatrixLocalVar } from "./TestMatrixLocalVar"
import { testMultipleSNodeTree } from "./TestMultipleSNodeTree"
import { testNdrange } from "./TestNdrange"
import { testVectorArithmetic } from "./TestVectorArithmetic"
import { testFloat } from "./TestFloat"
import { testSerial } from "./TestSerial"
import { testMath } from "./TestMath"
import { testKernelScope } from "./TestKernelScope"
import { testIf } from "./TestIf"
import { testWhile } from "./TestWhile"
import { testBreak } from "./TestBreak"
import { testContinue } from "./TestContinue"
import { testUnary } from "./TestUnary"
import { testArrowFunctionKernel } from "./TestArrowFunctionKernel"
import { testArgs } from "./TestArgs"
import { testFunc } from "./TestFunc"
import { testVectorComponent } from "./TestVectorComponent"
import { testPropertyFunc } from "./TestPropertyFunc"
import { testSwizzle } from "./TestSwizzle"
import { testRandom } from "./TestRandom"
import { testAtomic } from "./TestAtomic"
import { testMatrixOps } from "./TestMatrixOps"
import { testLibraryFuncs } from "./TestLibraryFuncs"
import { testStaticLoopUnroll } from "./TestStaticLoopUnroll"
import { testBroadcast } from "./TestBroadCast"
import { testTypes } from "./TestTypes"
import { testToArray } from "./TestToArray"
import { testFieldAccessor } from "./TestFieldAccessor"
import { testFromArray } from "./TestFromArray"
import { testStruct } from "./TestStruct"
import { testRets } from "./TestRets"
import { testArgAnnotation } from "./TestArgAnnotation"
import { testTemplateArgs } from "./TestTemplateArgs"
import { testLambda } from "./TestLambda"
import { testHostObjectReference } from "./TestHostObjectReferece"
import { testStaticIf } from "./TestStaticIf"
import { testClassKernel } from "./TestClassKernel"

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
    passed &&= await testAtomic()
    passed &&= await testMatrixOps()
    passed &&= await testLibraryFuncs()
    passed &&= await testStaticLoopUnroll()
    passed &&= await testBroadcast()
    passed &&= await testTypes()
    passed &&= await testToArray()
    passed &&= await testFieldAccessor()
    passed &&= await testFromArray()
    passed &&= await testStruct()
    passed &&= await testRets()
    passed &&= await testArgAnnotation()
    passed &&= await testTemplateArgs()
    passed &&= await testLambda()
    passed &&= await testHostObjectReference()
    passed &&= await testStaticIf()
    passed &&= await testClassKernel()

    if (passed) {
        console.log("All tests passed")
    }
    else {
        error("TESTS FAILED")
    }
}


export { runAllTests }