// using raw strings to avoid mimification problems..

let polar2dCode =
    `
(A, U, P) => {
    let x = A[0,0] + A[1,1]
    let y = A[1,0] - A[0,1]
    let scale = 1.0 / sqrt(x * x + y * y)
    let c = x * scale
    let s = y * scale
    let r = [[c, -s], [s, c]]
    U = r
    P = r.transpose().matmul(A) 
}
`

let svd2dCode =
    `
(A, U, E, V) => {
    let R = [[0.0, 0.0],[0.0, 0.0]]
    let S = [[0.0, 0.0],[0.0, 0.0]]
    ti.polarDecompose2D(A, R, S)
    let c = 0.0
    let s = 0.0
    let s1 = 0.0
    let s2 = 0.0
    if (ti.abs(S[0,1]) < 1e-5){
        c = 1.0
        s = 0.0
        s1 = S[0,0]
        s2 = S[1,1]
    }
    else{
        let tao = 0.5 * (S[0,0] - S[1,1])
        let w = ti.sqrt(tao * tao  + S[0,1] * S[0,1])
        let t = 0.0
        if (tao > 0){
            t = S[0,1] / (tao + w)
        }
        else{
            t = S[0,1] / (tao - w)
        }
        c = 1 / ti.sqrt (t*t + 1)
        s = -t * c
        s1 = c**2 * S[0, 0] - 2 * c * s * S[0, 1] + s**2 * S[1, 1]
        s2 = s**2 * S[0, 0] + 2 * c * s * S[0, 1] + c**2 * S[1, 1]
    }
    if (s1 < s2){
        let tmp = s1
        s1 = s2
        s2 = tmp
        V = [[-s, c], [-c, -s]]
    }
    else{
        V = [[c, s], [-s, c]]
    }
    U = R.matmul(V)
    E = [[s1,0.0], [0.0,s2]]
}
`

let svd3dCode =
    `
(A, U, E, V) => {

    let a00 = A[0, 0]
    let a01 = A[0, 1]
    let a02 = A[0, 2]
    let a10 = A[1, 0]
    let a11 = A[1, 1]
    let a12 = A[1, 2]
    let a20 = A[2, 0]
    let a21 = A[2, 1]
    let a22 = A[2, 2]

    let xffffffff = -1;

    let Ti = (x) => ti.i32(x)
    let int32 = (x) => ti.i32(x)
    let expr_select = (c, x, y) => {
        let result = x
        if (!c) {
            result = y
        }
        return result
    }
    let svd_bitwise_or = (f1, f2) => {
        return bitcast_f32(bitcast_i32(f1) | bitcast_i32(f2))
    }
    let svd_bitwise_xor = (f1, f2) => {
        return bitcast_f32(bitcast_i32(f1) ^ bitcast_i32(f2))
    }
    let svd_bitwise_and = (f1, f2) => {
        return bitcast_f32(bitcast_i32(f1) & bitcast_i32(f2))
    }

    let Four_Gamma_Squared = 5.82842712474619
    let Sine_Pi_Over_Eight = 0.3826834323650897
    let Cosine_Pi_Over_Eight = 0.9238795325112867


    let Sfour_gamma_squared = 0.0
    let Ssine_pi_over_eight = 0.0
    let Scosine_pi_over_eight = 0.0
    let Sone_half = 0.0
    let Sone = 0.0
    let Stiny_number = 0.0
    let Ssmall_number = 0.0
    let Sa11 = 0.0
    let Sa21 = 0.0
    let Sa31 = 0.0
    let Sa12 = 0.0
    let Sa22 = 0.0
    let Sa32 = 0.0
    let Sa13 = 0.0
    let Sa23 = 0.0
    let Sa33 = 0.0
    let Sv11 = 0.0
    let Sv21 = 0.0
    let Sv31 = 0.0
    let Sv12 = 0.0
    let Sv22 = 0.0
    let Sv32 = 0.0
    let Sv13 = 0.0
    let Sv23 = 0.0
    let Sv33 = 0.0
    let Su11 = 0.0
    let Su21 = 0.0
    let Su31 = 0.0
    let Su12 = 0.0
    let Su22 = 0.0
    let Su32 = 0.0
    let Su13 = 0.0
    let Su23 = 0.0
    let Su33 = 0.0
    let Sc = 0.0
    let Ss = 0.0
    let Sch = 0.0
    let Ssh = 0.0
    let Stmp1 = 0.0
    let Stmp2 = 0.0
    let Stmp3 = 0.0
    let Stmp4 = 0.0
    let Stmp5 = 0.0
    let Sqvs = 0.0
    let Sqvvx = 0.0
    let Sqvvy = 0.0
    let Sqvvz = 0.0
    let Ss11 = 0.0
    let Ss21 = 0.0
    let Ss31 = 0.0
    let Ss22 = 0.0
    let Ss32 = 0.0
    let Ss33 = 0.0
    Sfour_gamma_squared = Four_Gamma_Squared
    Ssine_pi_over_eight = Sine_Pi_Over_Eight
    Scosine_pi_over_eight = Cosine_Pi_Over_Eight
    Sone_half = 0.5
    Sone = 1.0
    Stiny_number = 1.e-20
    Ssmall_number = 1.e-12
    Sa11 = a00
    Sa21 = a10
    Sa31 = a20
    Sa12 = a01
    Sa22 = a11
    Sa32 = a21
    Sa13 = a02
    Sa23 = a12
    Sa33 = a22
    Sqvs = 1.0
    Sqvvx = 0.0
    Sqvvy = 0.0
    Sqvvz = 0.0
    Ss11 = Sa11 * Sa11
    Stmp1 = Sa21 * Sa21
    Ss11 = Stmp1 + Ss11
    Stmp1 = Sa31 * Sa31
    Ss11 = Stmp1 + Ss11
    Ss21 = Sa12 * Sa11
    Stmp1 = Sa22 * Sa21
    Ss21 = Stmp1 + Ss21
    Stmp1 = Sa32 * Sa31
    Ss21 = Stmp1 + Ss21
    Ss31 = Sa13 * Sa11
    Stmp1 = Sa23 * Sa21
    Ss31 = Stmp1 + Ss31
    Stmp1 = Sa33 * Sa31
    Ss31 = Stmp1 + Ss31
    Ss22 = Sa12 * Sa12
    Stmp1 = Sa22 * Sa22
    Ss22 = Stmp1 + Ss22
    Stmp1 = Sa32 * Sa32
    Ss22 = Stmp1 + Ss22
    Ss32 = Sa13 * Sa12
    Stmp1 = Sa23 * Sa22
    Ss32 = Stmp1 + Ss32
    Stmp1 = Sa33 * Sa32
    Ss32 = Stmp1 + Ss32
    Ss33 = Sa13 * Sa13
    Stmp1 = Sa23 * Sa23
    Ss33 = Stmp1 + Ss33
    Stmp1 = Sa33 * Sa33
    Ss33 = Stmp1 + Ss33
    for (let iter of range(5)) {
        Ssh = Ss21 * Sone_half
        Stmp5 = Ss11 - Ss22
        Stmp2 = Ssh * Ssh

        Stmp1 = bitcast_f32(expr_select(Stmp2 >= Stiny_number,
            xffffffff, 0))
        Ssh = svd_bitwise_and(Stmp1, Ssh)
        Sch = svd_bitwise_and(Stmp1, Stmp5)

        Stmp2 = svd_bitwise_and(not(bitcast_i32(Stmp1)), Sone)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Stmp3 = Stmp1 + Stmp2
        Stmp4 = rsqrt(Stmp3)
        Ssh = Stmp4 * Ssh
        Sch = Stmp4 * Sch
        Stmp1 = Sfour_gamma_squared * Stmp1
        Stmp1 = bitcast_f32(expr_select(
            Stmp2 <= Stmp1, xffffffff, 0))

        Stmp2 = svd_bitwise_and(Ssine_pi_over_eight, Stmp1)

        Ssh = svd_bitwise_and(~bitcast_i32(Stmp1), Ssh)
        Ssh = svd_bitwise_or(Ssh, Stmp2)
        Stmp2 = svd_bitwise_and(Scosine_pi_over_eight, Stmp1)
        Sch = svd_bitwise_and(~bitcast_i32(Stmp1), Sch)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Sc = Stmp2 - Stmp1
        Ss = Sch * Ssh
        Ss = Ss + Ss
        Stmp3 = Stmp1 + Stmp2
        Ss33 = Ss33 * Stmp3
        Ss31 = Ss31 * Stmp3
        Ss32 = Ss32 * Stmp3
        Ss33 = Ss33 * Stmp3
        Stmp1 = Ss * Ss31
        Stmp2 = Ss * Ss32
        Ss31 = Sc * Ss31
        Ss32 = Sc * Ss32
        Ss31 = Stmp2 + Ss31
        Ss32 = Ss32 - Stmp1
        Stmp2 = Ss * Ss
        Stmp1 = Ss22 * Stmp2
        Stmp3 = Ss11 * Stmp2
        Stmp4 = Sc * Sc
        Ss11 = Ss11 * Stmp4
        Ss22 = Ss22 * Stmp4
        Ss11 = Ss11 + Stmp1
        Ss22 = Ss22 + Stmp3
        Stmp4 = Stmp4 - Stmp2
        Stmp2 = Ss21 + Ss21
        Ss21 = Ss21 * Stmp4
        Stmp4 = Sc * Ss
        Stmp2 = Stmp2 * Stmp4
        Stmp5 = Stmp5 * Stmp4
        Ss11 = Ss11 + Stmp2
        Ss21 = Ss21 - Stmp5
        Ss22 = Ss22 - Stmp2
        Stmp1 = Ssh * Sqvvx
        Stmp2 = Ssh * Sqvvy
        Stmp3 = Ssh * Sqvvz
        Ssh = Ssh * Sqvs
        Sqvs = Sch * Sqvs
        Sqvvx = Sch * Sqvvx
        Sqvvy = Sch * Sqvvy
        Sqvvz = Sch * Sqvvz
        Sqvvz = Sqvvz + Ssh
        Sqvs = Sqvs - Stmp3
        Sqvvx = Sqvvx + Stmp2
        Sqvvy = Sqvvy - Stmp1
        Ssh = Ss32 * Sone_half
        Stmp5 = Ss22 - Ss33
        Stmp2 = Ssh * Ssh

        Stmp1 = bitcast_f32(expr_select(Stmp2 >= Stiny_number,
            xffffffff, 0))
        Ssh = svd_bitwise_and(Stmp1, Ssh)
        Sch = svd_bitwise_and(Stmp1, Stmp5)

        Stmp2 = svd_bitwise_and(~bitcast_i32(Stmp1), Sone)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Stmp3 = Stmp1 + Stmp2
        Stmp4 = rsqrt(Stmp3)
        Ssh = Stmp4 * Ssh
        Sch = Stmp4 * Sch
        Stmp1 = Sfour_gamma_squared * Stmp1

        Stmp1 = bitcast_f32(expr_select(
            Stmp2 <= Stmp1, xffffffff, 0))

        Stmp2 = svd_bitwise_and(Ssine_pi_over_eight, Stmp1)

        Ssh = svd_bitwise_and(~bitcast_i32(Stmp1), Ssh)
        Ssh = svd_bitwise_or(Ssh, Stmp2)

        Stmp2 = svd_bitwise_and(Scosine_pi_over_eight, Stmp1)

        Sch = svd_bitwise_and(~bitcast_i32(Stmp1), Sch)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Sc = Stmp2 - Stmp1
        Ss = Sch * Ssh
        Ss = Ss + Ss
        Stmp3 = Stmp1 + Stmp2
        Ss11 = Ss11 * Stmp3
        Ss21 = Ss21 * Stmp3
        Ss31 = Ss31 * Stmp3
        Ss11 = Ss11 * Stmp3
        Stmp1 = Ss * Ss21
        Stmp2 = Ss * Ss31
        Ss21 = Sc * Ss21
        Ss31 = Sc * Ss31
        Ss21 = Stmp2 + Ss21
        Ss31 = Ss31 - Stmp1
        Stmp2 = Ss * Ss
        Stmp1 = Ss33 * Stmp2
        Stmp3 = Ss22 * Stmp2
        Stmp4 = Sc * Sc
        Ss22 = Ss22 * Stmp4
        Ss33 = Ss33 * Stmp4
        Ss22 = Ss22 + Stmp1
        Ss33 = Ss33 + Stmp3
        Stmp4 = Stmp4 - Stmp2
        Stmp2 = Ss32 + Ss32
        Ss32 = Ss32 * Stmp4
        Stmp4 = Sc * Ss
        Stmp2 = Stmp2 * Stmp4
        Stmp5 = Stmp5 * Stmp4
        Ss22 = Ss22 + Stmp2
        Ss32 = Ss32 - Stmp5
        Ss33 = Ss33 - Stmp2
        Stmp1 = Ssh * Sqvvx
        Stmp2 = Ssh * Sqvvy
        Stmp3 = Ssh * Sqvvz
        Ssh = Ssh * Sqvs
        Sqvs = Sch * Sqvs
        Sqvvx = Sch * Sqvvx
        Sqvvy = Sch * Sqvvy
        Sqvvz = Sch * Sqvvz
        Sqvvx = Sqvvx + Ssh
        Sqvs = Sqvs - Stmp1
        Sqvvy = Sqvvy + Stmp3
        Sqvvz = Sqvvz - Stmp2
        Ssh = Ss31 * Sone_half
        Stmp5 = Ss33 - Ss11
        Stmp2 = Ssh * Ssh

        Stmp1 = bitcast_f32(expr_select(Stmp2 >= Stiny_number,
            xffffffff, 0))
        Ssh = svd_bitwise_and(Stmp1, Ssh)
        Sch = svd_bitwise_and(Stmp1, Stmp5)

        Stmp2 = svd_bitwise_and(~bitcast_i32(Stmp1), Sone)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Stmp3 = Stmp1 + Stmp2
        Stmp4 = rsqrt(Stmp3)
        Ssh = Stmp4 * Ssh
        Sch = Stmp4 * Sch
        Stmp1 = Sfour_gamma_squared * Stmp1

        Stmp1 = bitcast_f32(expr_select(
            Stmp2 <= Stmp1, xffffffff, 0))

        Stmp2 = svd_bitwise_and(Ssine_pi_over_eight, Stmp1)

        Ssh = svd_bitwise_and(~bitcast_i32(Stmp1), Ssh)
        Ssh = svd_bitwise_or(Ssh, Stmp2)

        Stmp2 = svd_bitwise_and(Scosine_pi_over_eight, Stmp1)

        Sch = svd_bitwise_and(~bitcast_i32(Stmp1), Sch)
        Sch = svd_bitwise_or(Sch, Stmp2)
        Stmp1 = Ssh * Ssh
        Stmp2 = Sch * Sch
        Sc = Stmp2 - Stmp1
        Ss = Sch * Ssh
        Ss = Ss + Ss
        Stmp3 = Stmp1 + Stmp2
        Ss22 = Ss22 * Stmp3
        Ss32 = Ss32 * Stmp3
        Ss21 = Ss21 * Stmp3
        Ss22 = Ss22 * Stmp3
        Stmp1 = Ss * Ss32
        Stmp2 = Ss * Ss21
        Ss32 = Sc * Ss32
        Ss21 = Sc * Ss21
        Ss32 = Stmp2 + Ss32
        Ss21 = Ss21 - Stmp1
        Stmp2 = Ss * Ss
        Stmp1 = Ss11 * Stmp2
        Stmp3 = Ss33 * Stmp2
        Stmp4 = Sc * Sc
        Ss33 = Ss33 * Stmp4
        Ss11 = Ss11 * Stmp4
        Ss33 = Ss33 + Stmp1
        Ss11 = Ss11 + Stmp3
        Stmp4 = Stmp4 - Stmp2
        Stmp2 = Ss31 + Ss31
        Ss31 = Ss31 * Stmp4
        Stmp4 = Sc * Ss
        Stmp2 = Stmp2 * Stmp4
        Stmp5 = Stmp5 * Stmp4
        Ss33 = Ss33 + Stmp2
        Ss31 = Ss31 - Stmp5
        Ss11 = Ss11 - Stmp2
        Stmp1 = Ssh * Sqvvx
        Stmp2 = Ssh * Sqvvy
        Stmp3 = Ssh * Sqvvz
        Ssh = Ssh * Sqvs
        Sqvs = Sch * Sqvs
        Sqvvx = Sch * Sqvvx
        Sqvvy = Sch * Sqvvy
        Sqvvz = Sch * Sqvvz
        Sqvvy = Sqvvy + Ssh
        Sqvs = Sqvs - Stmp2
        Sqvvz = Sqvvz + Stmp1
        Sqvvx = Sqvvx - Stmp3
    }
    Stmp2 = Sqvs * Sqvs
    Stmp1 = Sqvvx * Sqvvx
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = Sqvvy * Sqvvy
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = Sqvvz * Sqvvz
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Sqvs = Sqvs * Stmp1
    Sqvvx = Sqvvx * Stmp1
    Sqvvy = Sqvvy * Stmp1
    Sqvvz = Sqvvz * Stmp1
    Stmp1 = Sqvvx * Sqvvx
    Stmp2 = Sqvvy * Sqvvy
    Stmp3 = Sqvvz * Sqvvz
    Sv11 = Sqvs * Sqvs
    Sv22 = Sv11 - Stmp1
    Sv33 = Sv22 - Stmp2
    Sv33 = Sv33 + Stmp3
    Sv22 = Sv22 + Stmp2
    Sv22 = Sv22 - Stmp3
    Sv11 = Sv11 + Stmp1
    Sv11 = Sv11 - Stmp2
    Sv11 = Sv11 - Stmp3
    Stmp1 = Sqvvx + Sqvvx
    Stmp2 = Sqvvy + Sqvvy
    Stmp3 = Sqvvz + Sqvvz
    Sv32 = Sqvs * Stmp1
    Sv13 = Sqvs * Stmp2
    Sv21 = Sqvs * Stmp3
    Stmp1 = Sqvvy * Stmp1
    Stmp2 = Sqvvz * Stmp2
    Stmp3 = Sqvvx * Stmp3
    Sv12 = Stmp1 - Sv21
    Sv23 = Stmp2 - Sv32
    Sv31 = Stmp3 - Sv13
    Sv21 = Stmp1 + Sv21
    Sv32 = Stmp2 + Sv32
    Sv13 = Stmp3 + Sv13
    Stmp2 = Sa12
    Stmp3 = Sa13
    Sa12 = Sv12 * Sa11
    Sa13 = Sv13 * Sa11
    Sa11 = Sv11 * Sa11
    Stmp1 = Sv21 * Stmp2
    Sa11 = Sa11 + Stmp1
    Stmp1 = Sv31 * Stmp3
    Sa11 = Sa11 + Stmp1
    Stmp1 = Sv22 * Stmp2
    Sa12 = Sa12 + Stmp1
    Stmp1 = Sv32 * Stmp3
    Sa12 = Sa12 + Stmp1
    Stmp1 = Sv23 * Stmp2
    Sa13 = Sa13 + Stmp1
    Stmp1 = Sv33 * Stmp3
    Sa13 = Sa13 + Stmp1
    Stmp2 = Sa22
    Stmp3 = Sa23
    Sa22 = Sv12 * Sa21
    Sa23 = Sv13 * Sa21
    Sa21 = Sv11 * Sa21
    Stmp1 = Sv21 * Stmp2
    Sa21 = Sa21 + Stmp1
    Stmp1 = Sv31 * Stmp3
    Sa21 = Sa21 + Stmp1
    Stmp1 = Sv22 * Stmp2
    Sa22 = Sa22 + Stmp1
    Stmp1 = Sv32 * Stmp3
    Sa22 = Sa22 + Stmp1
    Stmp1 = Sv23 * Stmp2
    Sa23 = Sa23 + Stmp1
    Stmp1 = Sv33 * Stmp3
    Sa23 = Sa23 + Stmp1
    Stmp2 = Sa32
    Stmp3 = Sa33
    Sa32 = Sv12 * Sa31
    Sa33 = Sv13 * Sa31
    Sa31 = Sv11 * Sa31
    Stmp1 = Sv21 * Stmp2
    Sa31 = Sa31 + Stmp1
    Stmp1 = Sv31 * Stmp3
    Sa31 = Sa31 + Stmp1
    Stmp1 = Sv22 * Stmp2
    Sa32 = Sa32 + Stmp1
    Stmp1 = Sv32 * Stmp3
    Sa32 = Sa32 + Stmp1
    Stmp1 = Sv23 * Stmp2
    Sa33 = Sa33 + Stmp1
    Stmp1 = Sv33 * Stmp3
    Sa33 = Sa33 + Stmp1
    Stmp1 = Sa11 * Sa11
    Stmp4 = Sa21 * Sa21
    Stmp1 = Stmp1 + Stmp4
    Stmp4 = Sa31 * Sa31
    Stmp1 = Stmp1 + Stmp4
    Stmp2 = Sa12 * Sa12
    Stmp4 = Sa22 * Sa22
    Stmp2 = Stmp2 + Stmp4
    Stmp4 = Sa32 * Sa32
    Stmp2 = Stmp2 + Stmp4
    Stmp3 = Sa13 * Sa13
    Stmp4 = Sa23 * Sa23
    Stmp3 = Stmp3 + Stmp4
    Stmp4 = Sa33 * Sa33
    Stmp3 = Stmp3 + Stmp4

    Stmp4 = bitcast_f32(expr_select(
        Stmp1 < Stmp2, xffffffff, 0))
    Stmp5 = svd_bitwise_xor(Sa11, Sa12)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa11 = svd_bitwise_xor(Sa11, Stmp5)
    Sa12 = svd_bitwise_xor(Sa12, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa21, Sa22)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa21 = svd_bitwise_xor(Sa21, Stmp5)
    Sa22 = svd_bitwise_xor(Sa22, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa31, Sa32)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa31 = svd_bitwise_xor(Sa31, Stmp5)
    Sa32 = svd_bitwise_xor(Sa32, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv11, Sv12)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv11 = svd_bitwise_xor(Sv11, Stmp5)
    Sv12 = svd_bitwise_xor(Sv12, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv21, Sv22)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv21 = svd_bitwise_xor(Sv21, Stmp5)
    Sv22 = svd_bitwise_xor(Sv22, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv31, Sv32)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv31 = svd_bitwise_xor(Sv31, Stmp5)
    Sv32 = svd_bitwise_xor(Sv32, Stmp5)
    Stmp5 = svd_bitwise_xor(Stmp1, Stmp2)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp1 = svd_bitwise_xor(Stmp1, Stmp5)
    Stmp2 = svd_bitwise_xor(Stmp2, Stmp5)
    Stmp5 = -2.0
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp4 = 1.0
    Stmp4 = Stmp4 + Stmp5
    Sa12 = Sa12 * Stmp4
    Sa22 = Sa22 * Stmp4
    Sa32 = Sa32 * Stmp4
    Sv12 = Sv12 * Stmp4
    Sv22 = Sv22 * Stmp4
    Sv32 = Sv32 * Stmp4

    Stmp4 = bitcast_f32(expr_select(
        Stmp1 < Stmp3, xffffffff, 0))
    Stmp5 = svd_bitwise_xor(Sa11, Sa13)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa11 = svd_bitwise_xor(Sa11, Stmp5)
    Sa13 = svd_bitwise_xor(Sa13, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa21, Sa23)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa21 = svd_bitwise_xor(Sa21, Stmp5)
    Sa23 = svd_bitwise_xor(Sa23, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa31, Sa33)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa31 = svd_bitwise_xor(Sa31, Stmp5)
    Sa33 = svd_bitwise_xor(Sa33, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv11, Sv13)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv11 = svd_bitwise_xor(Sv11, Stmp5)
    Sv13 = svd_bitwise_xor(Sv13, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv21, Sv23)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv21 = svd_bitwise_xor(Sv21, Stmp5)
    Sv23 = svd_bitwise_xor(Sv23, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv31, Sv33)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv31 = svd_bitwise_xor(Sv31, Stmp5)
    Sv33 = svd_bitwise_xor(Sv33, Stmp5)
    Stmp5 = svd_bitwise_xor(Stmp1, Stmp3)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp1 = svd_bitwise_xor(Stmp1, Stmp5)
    Stmp3 = svd_bitwise_xor(Stmp3, Stmp5)
    Stmp5 = -2.0
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp4 = 1.0
    Stmp4 = Stmp4 + Stmp5
    Sa11 = Sa11 * Stmp4
    Sa21 = Sa21 * Stmp4
    Sa31 = Sa31 * Stmp4
    Sv11 = Sv11 * Stmp4
    Sv21 = Sv21 * Stmp4
    Sv31 = Sv31 * Stmp4

    Stmp4 = bitcast_f32(expr_select(
        Stmp2 < Stmp3, xffffffff, 0))
    Stmp5 = svd_bitwise_xor(Sa12, Sa13)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa12 = svd_bitwise_xor(Sa12, Stmp5)
    Sa13 = svd_bitwise_xor(Sa13, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa22, Sa23)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa22 = svd_bitwise_xor(Sa22, Stmp5)
    Sa23 = svd_bitwise_xor(Sa23, Stmp5)
    Stmp5 = svd_bitwise_xor(Sa32, Sa33)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sa32 = svd_bitwise_xor(Sa32, Stmp5)
    Sa33 = svd_bitwise_xor(Sa33, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv12, Sv13)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv12 = svd_bitwise_xor(Sv12, Stmp5)
    Sv13 = svd_bitwise_xor(Sv13, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv22, Sv23)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv22 = svd_bitwise_xor(Sv22, Stmp5)
    Sv23 = svd_bitwise_xor(Sv23, Stmp5)
    Stmp5 = svd_bitwise_xor(Sv32, Sv33)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Sv32 = svd_bitwise_xor(Sv32, Stmp5)
    Sv33 = svd_bitwise_xor(Sv33, Stmp5)
    Stmp5 = svd_bitwise_xor(Stmp2, Stmp3)
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp2 = svd_bitwise_xor(Stmp2, Stmp5)
    Stmp3 = svd_bitwise_xor(Stmp3, Stmp5)
    Stmp5 = -2.0
    Stmp5 = svd_bitwise_and(Stmp5, Stmp4)
    Stmp4 = 1.0
    Stmp4 = Stmp4 + Stmp5
    Sa13 = Sa13 * Stmp4
    Sa23 = Sa23 * Stmp4
    Sa33 = Sa33 * Stmp4
    Sv13 = Sv13 * Stmp4
    Sv23 = Sv23 * Stmp4
    Sv33 = Sv33 * Stmp4
    Su11 = 1.0
    Su21 = 0.0
    Su31 = 0.0
    Su12 = 0.0
    Su22 = 1.0
    Su32 = 0.0
    Su13 = 0.0
    Su23 = 0.0
    Su33 = 1.0
    Ssh = Sa21 * Sa21

    Ssh = bitcast_f32(expr_select(Ssh >= Ssmall_number,
        xffffffff, 0))
    Ssh = svd_bitwise_and(Ssh, Sa21)
    Stmp5 = 0.0
    Sch = Stmp5 - Sa11
    Sch = ti.max(Sch, Sa11)
    Sch = ti.max(Sch, Ssmall_number)

    Stmp5 = bitcast_f32(expr_select(
        Sa11 >= Stmp5, xffffffff, 0))
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Stmp1 = Stmp1 * Stmp2
    Sch = Sch + Stmp1

    Stmp1 = svd_bitwise_and(~bitcast_i32(Stmp5), Ssh)

    Stmp2 = svd_bitwise_and(~bitcast_i32(Stmp5), Sch)
    Sch = svd_bitwise_and(Stmp5, Sch)
    Ssh = svd_bitwise_and(Stmp5, Ssh)
    Sch = svd_bitwise_or(Sch, Stmp1)
    Ssh = svd_bitwise_or(Ssh, Stmp2)
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Sch = Sch * Stmp1
    Ssh = Ssh * Stmp1
    Sc = Sch * Sch
    Ss = Ssh * Ssh
    Sc = Sc - Ss
    Ss = Ssh * Sch
    Ss = Ss + Ss
    Stmp1 = Ss * Sa11
    Stmp2 = Ss * Sa21
    Sa11 = Sc * Sa11
    Sa21 = Sc * Sa21
    Sa11 = Sa11 + Stmp2
    Sa21 = Sa21 - Stmp1
    Stmp1 = Ss * Sa12
    Stmp2 = Ss * Sa22
    Sa12 = Sc * Sa12
    Sa22 = Sc * Sa22
    Sa12 = Sa12 + Stmp2
    Sa22 = Sa22 - Stmp1
    Stmp1 = Ss * Sa13
    Stmp2 = Ss * Sa23
    Sa13 = Sc * Sa13
    Sa23 = Sc * Sa23
    Sa13 = Sa13 + Stmp2
    Sa23 = Sa23 - Stmp1
    Stmp1 = Ss * Su11
    Stmp2 = Ss * Su12
    Su11 = Sc * Su11
    Su12 = Sc * Su12
    Su11 = Su11 + Stmp2
    Su12 = Su12 - Stmp1
    Stmp1 = Ss * Su21
    Stmp2 = Ss * Su22
    Su21 = Sc * Su21
    Su22 = Sc * Su22
    Su21 = Su21 + Stmp2
    Su22 = Su22 - Stmp1
    Stmp1 = Ss * Su31
    Stmp2 = Ss * Su32
    Su31 = Sc * Su31
    Su32 = Sc * Su32
    Su31 = Su31 + Stmp2
    Su32 = Su32 - Stmp1
    Ssh = Sa31 * Sa31

    Ssh = bitcast_f32(expr_select(Ssh >= Ssmall_number,
        xffffffff, 0))
    Ssh = svd_bitwise_and(Ssh, Sa31)
    Stmp5 = 0.0
    Sch = Stmp5 - Sa11
    Sch = ti.max(Sch, Sa11)
    Sch = ti.max(Sch, Ssmall_number)

    Stmp5 = bitcast_f32(expr_select(
        Sa11 >= Stmp5, xffffffff, 0))
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Stmp1 = Stmp1 * Stmp2
    Sch = Sch + Stmp1

    Stmp1 = svd_bitwise_and(~bitcast_i32(Stmp5), Ssh)

    Stmp2 = svd_bitwise_and(~bitcast_i32(Stmp5), Sch)
    Sch = svd_bitwise_and(Stmp5, Sch)
    Ssh = svd_bitwise_and(Stmp5, Ssh)
    Sch = svd_bitwise_or(Sch, Stmp1)
    Ssh = svd_bitwise_or(Ssh, Stmp2)
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Sch = Sch * Stmp1
    Ssh = Ssh * Stmp1
    Sc = Sch * Sch
    Ss = Ssh * Ssh
    Sc = Sc - Ss
    Ss = Ssh * Sch
    Ss = Ss + Ss
    Stmp1 = Ss * Sa11
    Stmp2 = Ss * Sa31
    Sa11 = Sc * Sa11
    Sa31 = Sc * Sa31
    Sa11 = Sa11 + Stmp2
    Sa31 = Sa31 - Stmp1
    Stmp1 = Ss * Sa12
    Stmp2 = Ss * Sa32
    Sa12 = Sc * Sa12
    Sa32 = Sc * Sa32
    Sa12 = Sa12 + Stmp2
    Sa32 = Sa32 - Stmp1
    Stmp1 = Ss * Sa13
    Stmp2 = Ss * Sa33
    Sa13 = Sc * Sa13
    Sa33 = Sc * Sa33
    Sa13 = Sa13 + Stmp2
    Sa33 = Sa33 - Stmp1
    Stmp1 = Ss * Su11
    Stmp2 = Ss * Su13
    Su11 = Sc * Su11
    Su13 = Sc * Su13
    Su11 = Su11 + Stmp2
    Su13 = Su13 - Stmp1
    Stmp1 = Ss * Su21
    Stmp2 = Ss * Su23
    Su21 = Sc * Su21
    Su23 = Sc * Su23
    Su21 = Su21 + Stmp2
    Su23 = Su23 - Stmp1
    Stmp1 = Ss * Su31
    Stmp2 = Ss * Su33
    Su31 = Sc * Su31
    Su33 = Sc * Su33
    Su31 = Su31 + Stmp2
    Su33 = Su33 - Stmp1
    Ssh = Sa32 * Sa32

    Ssh = bitcast_f32(expr_select(Ssh >= Ssmall_number,
        xffffffff, 0))
    Ssh = svd_bitwise_and(Ssh, Sa32)
    Stmp5 = 0.0
    Sch = Stmp5 - Sa22
    Sch = ti.max(Sch, Sa22)
    Sch = ti.max(Sch, Ssmall_number)

    Stmp5 = bitcast_f32(expr_select(
        Sa22 >= Stmp5, xffffffff, 0))
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Stmp1 = Stmp1 * Stmp2
    Sch = Sch + Stmp1

    Stmp1 = svd_bitwise_and(~bitcast_i32(Stmp5), Ssh)

    Stmp2 = svd_bitwise_and(~bitcast_i32(Stmp5), Sch)
    Sch = svd_bitwise_and(Stmp5, Sch)
    Ssh = svd_bitwise_and(Stmp5, Ssh)
    Sch = svd_bitwise_or(Sch, Stmp1)
    Ssh = svd_bitwise_or(Ssh, Stmp2)
    Stmp1 = Sch * Sch
    Stmp2 = Ssh * Ssh
    Stmp2 = Stmp1 + Stmp2
    Stmp1 = rsqrt(Stmp2)
    Stmp4 = Stmp1 * Sone_half
    Stmp3 = Stmp1 * Stmp4
    Stmp3 = Stmp1 * Stmp3
    Stmp3 = Stmp2 * Stmp3
    Stmp1 = Stmp1 + Stmp4
    Stmp1 = Stmp1 - Stmp3
    Sch = Sch * Stmp1
    Ssh = Ssh * Stmp1
    Sc = Sch * Sch
    Ss = Ssh * Ssh
    Sc = Sc - Ss
    Ss = Ssh * Sch
    Ss = Ss + Ss
    Stmp1 = Ss * Sa21
    Stmp2 = Ss * Sa31
    Sa21 = Sc * Sa21
    Sa31 = Sc * Sa31
    Sa21 = Sa21 + Stmp2
    Sa31 = Sa31 - Stmp1
    Stmp1 = Ss * Sa22
    Stmp2 = Ss * Sa32
    Sa22 = Sc * Sa22
    Sa32 = Sc * Sa32
    Sa22 = Sa22 + Stmp2
    Sa32 = Sa32 - Stmp1
    Stmp1 = Ss * Sa23
    Stmp2 = Ss * Sa33
    Sa23 = Sc * Sa23
    Sa33 = Sc * Sa33
    Sa23 = Sa23 + Stmp2
    Sa33 = Sa33 - Stmp1
    Stmp1 = Ss * Su12
    Stmp2 = Ss * Su13
    Su12 = Sc * Su12
    Su13 = Sc * Su13
    Su12 = Su12 + Stmp2
    Su13 = Su13 - Stmp1
    Stmp1 = Ss * Su22
    Stmp2 = Ss * Su23
    Su22 = Sc * Su22
    Su23 = Sc * Su23
    Su22 = Su22 + Stmp2
    Su23 = Su23 - Stmp1
    Stmp1 = Ss * Su32
    Stmp2 = Ss * Su33
    Su32 = Sc * Su32
    Su33 = Sc * Su33
    Su32 = Su32 + Stmp2
    Su33 = Su33 - Stmp1

    U = [[Su11, Su12, Su13], [Su21, Su22, Su23], [Su31, Su32, Su33]]
    V = [[Sv11, Sv12, Sv13], [Sv21, Sv22, Sv23], [Sv31, Sv32, Sv33]]
    E = [[Sa11, 0.0, 0.0], [0.0, Sa22, 0.0], [0.0, 0.0, Sa33]]
}
`

let lookAtCode = `
(eye, center, up) => {
    let z = (eye - center).normalized()
    let x = up.cross(z).normalized()
    let y = z.cross(x).normalized()
    let result = [
        (x, -x.dot(eye)),
        (y, -y.dot(eye)),
        (z, -z.dot(eye)),
        [0,0,0,1]
    ]
    return result
}
`

let perspectiveCode =
    `
(fovy, aspect, zNear, zFar) => {
    let rad = fovy * Math.PI / 180.0 
    let tanHalfFovy = ti.tan(rad / 2.0)
    
    let zero4 = [0.0, 0.0, 0.0, 0.0]
    let result = [zero4, zero4, zero4, zero4]

    result[0,0] = 1.0 / (aspect * tanHalfFovy)
    result[1,1] = 1.0 / (tanHalfFovy)
    result[2,2] = - (zFar + zNear) / (zFar - zNear)
    result[3,2] = - 1.0
    result[2,3] = - (2.0 * zFar * zNear) / (zFar - zNear)
    return result;
}
`

let inverseCode =
    `
(m) => {
    let det = m[[0, 0]] * (m[[1, 1]] * m[[2, 2]] - m[[2, 1]] * m[[1, 2]]) -
             m[[0, 1]] * (m[[1, 0]] * m[[2, 2]] - m[[1, 2]] * m[[2, 0]]) +
             m[[0, 2]] * (m[[1, 0]] * m[[2, 1]] - m[[1, 1]] * m[[2, 0]]);

    let invdet = 1 / det;

    let minv = [
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
    ];
    minv[[0, 0]] = (m[[1, 1]] * m[[2, 2]] - m[[2, 1]] * m[[1, 2]]) * invdet;
    minv[[0, 1]] = (m[[0, 2]] * m[[2, 1]] - m[[0, 1]] * m[[2, 2]]) * invdet;
    minv[[0, 2]] = (m[[0, 1]] * m[[1, 2]] - m[[0, 2]] * m[[1, 1]]) * invdet;
    minv[[1, 0]] = (m[[1, 2]] * m[[2, 0]] - m[[1, 0]] * m[[2, 2]]) * invdet;
    minv[[1, 1]] = (m[[0, 0]] * m[[2, 2]] - m[[0, 2]] * m[[2, 0]]) * invdet;
    minv[[1, 2]] = (m[[1, 0]] * m[[0, 2]] - m[[0, 0]] * m[[1, 2]]) * invdet;
    minv[[2, 0]] = (m[[1, 0]] * m[[2, 1]] - m[[2, 0]] * m[[1, 1]]) * invdet;
    minv[[2, 1]] = (m[[2, 0]] * m[[0, 1]] - m[[0, 0]] * m[[2, 1]]) * invdet;
    minv[[2, 2]] = (m[[0, 0]] * m[[1, 1]] - m[[1, 0]] * m[[0, 1]]) * invdet;
    return minv;
}
`

class LibraryFunc {
    constructor(public name: string, public numArgs: number, public code: string) {

    }

    public static getLibraryFuncs(): Map<string, LibraryFunc> {
        let funcs: LibraryFunc[] = [
            new LibraryFunc("polarDecompose2D", 3, polar2dCode),
            new LibraryFunc("svd2D", 4, svd2dCode),
            new LibraryFunc("svd3D", 4, svd3dCode),
            new LibraryFunc("lookAt", 3, lookAtCode),
            new LibraryFunc("perspective", 4, perspectiveCode),
            new LibraryFunc("inverse", 1, inverseCode),
        ]

        let funcsMap = new Map<string, LibraryFunc>()
        for (let f of funcs) {
            funcsMap.set(f.name, f)
        }
        return funcsMap
    }
}



export { LibraryFunc }