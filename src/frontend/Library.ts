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
        let w = ti.sqrt(tao ** 2  + S[0,1] ** 2)
        let t = 0.0
        if (tao > 0){
            t = S[0,1] / (tao + w)
        }
        else{
            t = S[0,1] / (tao - w)
        }
        c = 1 / ti.sqrt (t**2 + 1)
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

    let Expr = (x) => x;
    let Var = (x) => x;
    let Tf = (x) => ti.f32(x);
    let Ti = (x) => ti.i32(x);
    let int32 = (x) => ti.i32(x);
    let insert_assignment = (x, y) => { x = y }
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


    let Sfour_gamma_squared = Var(Expr(Tf(0.0)));
    let Ssine_pi_over_eight = Var(Expr(Tf(0.0)));
    let Scosine_pi_over_eight = Var(Expr(Tf(0.0)));
    let Sone_half = Var(Expr(Tf(0.0)));
    let Sone = Var(Expr(Tf(0.0)));
    let Stiny_number = Var(Expr(Tf(0.0)));
    let Ssmall_number = Var(Expr(Tf(0.0)));
    let Sa11 = Var(Expr(Tf(0.0)));
    let Sa21 = Var(Expr(Tf(0.0)));
    let Sa31 = Var(Expr(Tf(0.0)));
    let Sa12 = Var(Expr(Tf(0.0)));
    let Sa22 = Var(Expr(Tf(0.0)));
    let Sa32 = Var(Expr(Tf(0.0)));
    let Sa13 = Var(Expr(Tf(0.0)));
    let Sa23 = Var(Expr(Tf(0.0)));
    let Sa33 = Var(Expr(Tf(0.0)));
    let Sv11 = Var(Expr(Tf(0.0)));
    let Sv21 = Var(Expr(Tf(0.0)));
    let Sv31 = Var(Expr(Tf(0.0)));
    let Sv12 = Var(Expr(Tf(0.0)));
    let Sv22 = Var(Expr(Tf(0.0)));
    let Sv32 = Var(Expr(Tf(0.0)));
    let Sv13 = Var(Expr(Tf(0.0)));
    let Sv23 = Var(Expr(Tf(0.0)));
    let Sv33 = Var(Expr(Tf(0.0)));
    let Su11 = Var(Expr(Tf(0.0)));
    let Su21 = Var(Expr(Tf(0.0)));
    let Su31 = Var(Expr(Tf(0.0)));
    let Su12 = Var(Expr(Tf(0.0)));
    let Su22 = Var(Expr(Tf(0.0)));
    let Su32 = Var(Expr(Tf(0.0)));
    let Su13 = Var(Expr(Tf(0.0)));
    let Su23 = Var(Expr(Tf(0.0)));
    let Su33 = Var(Expr(Tf(0.0)));
    let Sc = Var(Expr(Tf(0.0)));
    let Ss = Var(Expr(Tf(0.0)));
    let Sch = Var(Expr(Tf(0.0)));
    let Ssh = Var(Expr(Tf(0.0)));
    let Stmp1 = Var(Expr(Tf(0.0)));
    let Stmp2 = Var(Expr(Tf(0.0)));
    let Stmp3 = Var(Expr(Tf(0.0)));
    let Stmp4 = Var(Expr(Tf(0.0)));
    let Stmp5 = Var(Expr(Tf(0.0)));
    let Sqvs = Var(Expr(Tf(0.0)));
    let Sqvvx = Var(Expr(Tf(0.0)));
    let Sqvvy = Var(Expr(Tf(0.0)));
    let Sqvvz = Var(Expr(Tf(0.0)));
    let Ss11 = Var(Expr(Tf(0.0)));
    let Ss21 = Var(Expr(Tf(0.0)));
    let Ss31 = Var(Expr(Tf(0.0)));
    let Ss22 = Var(Expr(Tf(0.0)));
    let Ss32 = Var(Expr(Tf(0.0)));
    let Ss33 = Var(Expr(Tf(0.0)));
    insert_assignment(Sfour_gamma_squared, Expr(Four_Gamma_Squared));
    insert_assignment(Ssine_pi_over_eight, Expr(Sine_Pi_Over_Eight));
    insert_assignment(Scosine_pi_over_eight,
        Expr(Cosine_Pi_Over_Eight));
    insert_assignment(Sone_half, Expr(Tf(0.5)));
    insert_assignment(Sone, Expr(Tf(1.0)));
    insert_assignment(Stiny_number, Expr(Tf(1.e-20)));
    insert_assignment(Ssmall_number, Expr(Tf(1.e-12)));
    insert_assignment(Sa11, a00);
    insert_assignment(Sa21, a10);
    insert_assignment(Sa31, a20);
    insert_assignment(Sa12, a01);
    insert_assignment(Sa22, a11);
    insert_assignment(Sa32, a21);
    insert_assignment(Sa13, a02);
    insert_assignment(Sa23, a12);
    insert_assignment(Sa33, a22);
    insert_assignment(Sqvs, Expr(Tf(1.0)));
    insert_assignment(Sqvvx, Expr(Tf(0.0)));
    insert_assignment(Sqvvy, Expr(Tf(0.0)));
    insert_assignment(Sqvvz, Expr(Tf(0.0)));
    insert_assignment(Ss11, Sa11 * Sa11);
    insert_assignment(Stmp1, Sa21 * Sa21);
    insert_assignment(Ss11, Stmp1 + Ss11);
    insert_assignment(Stmp1, Sa31 * Sa31);
    insert_assignment(Ss11, Stmp1 + Ss11);
    insert_assignment(Ss21, Sa12 * Sa11);
    insert_assignment(Stmp1, Sa22 * Sa21);
    insert_assignment(Ss21, Stmp1 + Ss21);
    insert_assignment(Stmp1, Sa32 * Sa31);
    insert_assignment(Ss21, Stmp1 + Ss21);
    insert_assignment(Ss31, Sa13 * Sa11);
    insert_assignment(Stmp1, Sa23 * Sa21);
    insert_assignment(Ss31, Stmp1 + Ss31);
    insert_assignment(Stmp1, Sa33 * Sa31);
    insert_assignment(Ss31, Stmp1 + Ss31);
    insert_assignment(Ss22, Sa12 * Sa12);
    insert_assignment(Stmp1, Sa22 * Sa22);
    insert_assignment(Ss22, Stmp1 + Ss22);
    insert_assignment(Stmp1, Sa32 * Sa32);
    insert_assignment(Ss22, Stmp1 + Ss22);
    insert_assignment(Ss32, Sa13 * Sa12);
    insert_assignment(Stmp1, Sa23 * Sa22);
    insert_assignment(Ss32, Stmp1 + Ss32);
    insert_assignment(Stmp1, Sa33 * Sa32);
    insert_assignment(Ss32, Stmp1 + Ss32);
    insert_assignment(Ss33, Sa13 * Sa13);
    insert_assignment(Stmp1, Sa23 * Sa23);
    insert_assignment(Ss33, Stmp1 + Ss33);
    insert_assignment(Stmp1, Sa33 * Sa33);
    insert_assignment(Ss33, Stmp1 + Ss33);
    for (let iter of range(5)) {
        insert_assignment(Ssh, Ss21 * Sone_half);
        insert_assignment(Stmp5, Ss11 - Ss22);
        insert_assignment(Stmp2, Ssh * Ssh);
        insert_assignment(
            Stmp1,
            bitcast_f32(expr_select(Stmp2 >= Stiny_number,
                Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(Ssh, svd_bitwise_and(Stmp1, Ssh));
        insert_assignment(Sch, svd_bitwise_and(Stmp1, Stmp5));
        insert_assignment(
            Stmp2, svd_bitwise_and(Expr(not(bitcast_i32(Stmp1))), Sone));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Stmp4, rsqrt(Stmp3));
        insert_assignment(Ssh, Stmp4 * Ssh);
        insert_assignment(Sch, Stmp4 * Sch);
        insert_assignment(Stmp1, Sfour_gamma_squared * Stmp1);
        insert_assignment(
            Stmp1, bitcast_f32(expr_select(
                Stmp2 <= Stmp1, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(
            Stmp2, svd_bitwise_and(Ssine_pi_over_eight, Stmp1));
        insert_assignment(
            Ssh, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Ssh));
        insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
        insert_assignment(
            Stmp2, svd_bitwise_and(Scosine_pi_over_eight, Stmp1));
        insert_assignment(
            Sch, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Sch));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Sc, Stmp2 - Stmp1);
        insert_assignment(Ss, Sch * Ssh);
        insert_assignment(Ss, Ss + Ss);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Ss33, Ss33 * Stmp3);
        insert_assignment(Ss31, Ss31 * Stmp3);
        insert_assignment(Ss32, Ss32 * Stmp3);
        insert_assignment(Ss33, Ss33 * Stmp3);
        insert_assignment(Stmp1, Ss * Ss31);
        insert_assignment(Stmp2, Ss * Ss32);
        insert_assignment(Ss31, Sc * Ss31);
        insert_assignment(Ss32, Sc * Ss32);
        insert_assignment(Ss31, Stmp2 + Ss31);
        insert_assignment(Ss32, Ss32 - Stmp1);
        insert_assignment(Stmp2, Ss * Ss);
        insert_assignment(Stmp1, Ss22 * Stmp2);
        insert_assignment(Stmp3, Ss11 * Stmp2);
        insert_assignment(Stmp4, Sc * Sc);
        insert_assignment(Ss11, Ss11 * Stmp4);
        insert_assignment(Ss22, Ss22 * Stmp4);
        insert_assignment(Ss11, Ss11 + Stmp1);
        insert_assignment(Ss22, Ss22 + Stmp3);
        insert_assignment(Stmp4, Stmp4 - Stmp2);
        insert_assignment(Stmp2, Ss21 + Ss21);
        insert_assignment(Ss21, Ss21 * Stmp4);
        insert_assignment(Stmp4, Sc * Ss);
        insert_assignment(Stmp2, Stmp2 * Stmp4);
        insert_assignment(Stmp5, Stmp5 * Stmp4);
        insert_assignment(Ss11, Ss11 + Stmp2);
        insert_assignment(Ss21, Ss21 - Stmp5);
        insert_assignment(Ss22, Ss22 - Stmp2);
        insert_assignment(Stmp1, Ssh * Sqvvx);
        insert_assignment(Stmp2, Ssh * Sqvvy);
        insert_assignment(Stmp3, Ssh * Sqvvz);
        insert_assignment(Ssh, Ssh * Sqvs);
        insert_assignment(Sqvs, Sch * Sqvs);
        insert_assignment(Sqvvx, Sch * Sqvvx);
        insert_assignment(Sqvvy, Sch * Sqvvy);
        insert_assignment(Sqvvz, Sch * Sqvvz);
        insert_assignment(Sqvvz, Sqvvz + Ssh);
        insert_assignment(Sqvs, Sqvs - Stmp3);
        insert_assignment(Sqvvx, Sqvvx + Stmp2);
        insert_assignment(Sqvvy, Sqvvy - Stmp1);
        insert_assignment(Ssh, Ss32 * Sone_half);
        insert_assignment(Stmp5, Ss22 - Ss33);
        insert_assignment(Stmp2, Ssh * Ssh);
        insert_assignment(
            Stmp1,
            bitcast_f32(expr_select(Stmp2 >= Stiny_number,
                Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(Ssh, svd_bitwise_and(Stmp1, Ssh));
        insert_assignment(Sch, svd_bitwise_and(Stmp1, Stmp5));
        insert_assignment(
            Stmp2, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Sone));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Stmp4, rsqrt(Stmp3));
        insert_assignment(Ssh, Stmp4 * Ssh);
        insert_assignment(Sch, Stmp4 * Sch);
        insert_assignment(Stmp1, Sfour_gamma_squared * Stmp1);
        insert_assignment(
            Stmp1, bitcast_f32(expr_select(
                Stmp2 <= Stmp1, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(
            Stmp2, svd_bitwise_and(Ssine_pi_over_eight, Stmp1));
        insert_assignment(
            Ssh, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Ssh));
        insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
        insert_assignment(
            Stmp2, svd_bitwise_and(Scosine_pi_over_eight, Stmp1));
        insert_assignment(
            Sch, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Sch));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Sc, Stmp2 - Stmp1);
        insert_assignment(Ss, Sch * Ssh);
        insert_assignment(Ss, Ss + Ss);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Ss11, Ss11 * Stmp3);
        insert_assignment(Ss21, Ss21 * Stmp3);
        insert_assignment(Ss31, Ss31 * Stmp3);
        insert_assignment(Ss11, Ss11 * Stmp3);
        insert_assignment(Stmp1, Ss * Ss21);
        insert_assignment(Stmp2, Ss * Ss31);
        insert_assignment(Ss21, Sc * Ss21);
        insert_assignment(Ss31, Sc * Ss31);
        insert_assignment(Ss21, Stmp2 + Ss21);
        insert_assignment(Ss31, Ss31 - Stmp1);
        insert_assignment(Stmp2, Ss * Ss);
        insert_assignment(Stmp1, Ss33 * Stmp2);
        insert_assignment(Stmp3, Ss22 * Stmp2);
        insert_assignment(Stmp4, Sc * Sc);
        insert_assignment(Ss22, Ss22 * Stmp4);
        insert_assignment(Ss33, Ss33 * Stmp4);
        insert_assignment(Ss22, Ss22 + Stmp1);
        insert_assignment(Ss33, Ss33 + Stmp3);
        insert_assignment(Stmp4, Stmp4 - Stmp2);
        insert_assignment(Stmp2, Ss32 + Ss32);
        insert_assignment(Ss32, Ss32 * Stmp4);
        insert_assignment(Stmp4, Sc * Ss);
        insert_assignment(Stmp2, Stmp2 * Stmp4);
        insert_assignment(Stmp5, Stmp5 * Stmp4);
        insert_assignment(Ss22, Ss22 + Stmp2);
        insert_assignment(Ss32, Ss32 - Stmp5);
        insert_assignment(Ss33, Ss33 - Stmp2);
        insert_assignment(Stmp1, Ssh * Sqvvx);
        insert_assignment(Stmp2, Ssh * Sqvvy);
        insert_assignment(Stmp3, Ssh * Sqvvz);
        insert_assignment(Ssh, Ssh * Sqvs);
        insert_assignment(Sqvs, Sch * Sqvs);
        insert_assignment(Sqvvx, Sch * Sqvvx);
        insert_assignment(Sqvvy, Sch * Sqvvy);
        insert_assignment(Sqvvz, Sch * Sqvvz);
        insert_assignment(Sqvvx, Sqvvx + Ssh);
        insert_assignment(Sqvs, Sqvs - Stmp1);
        insert_assignment(Sqvvy, Sqvvy + Stmp3);
        insert_assignment(Sqvvz, Sqvvz - Stmp2);
        insert_assignment(Ssh, Ss31 * Sone_half);
        insert_assignment(Stmp5, Ss33 - Ss11);
        insert_assignment(Stmp2, Ssh * Ssh);
        insert_assignment(
            Stmp1,
            bitcast_f32(expr_select(Stmp2 >= Stiny_number,
                Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(Ssh, svd_bitwise_and(Stmp1, Ssh));
        insert_assignment(Sch, svd_bitwise_and(Stmp1, Stmp5));
        insert_assignment(
            Stmp2, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Sone));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Stmp4, rsqrt(Stmp3));
        insert_assignment(Ssh, Stmp4 * Ssh);
        insert_assignment(Sch, Stmp4 * Sch);
        insert_assignment(Stmp1, Sfour_gamma_squared * Stmp1);
        insert_assignment(
            Stmp1, bitcast_f32(expr_select(
                Stmp2 <= Stmp1, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
        insert_assignment(
            Stmp2, svd_bitwise_and(Ssine_pi_over_eight, Stmp1));
        insert_assignment(
            Ssh, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Ssh));
        insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
        insert_assignment(
            Stmp2, svd_bitwise_and(Scosine_pi_over_eight, Stmp1));
        insert_assignment(
            Sch, svd_bitwise_and(Expr(~bitcast_i32(Stmp1)), Sch));
        insert_assignment(Sch, svd_bitwise_or(Sch, Stmp2));
        insert_assignment(Stmp1, Ssh * Ssh);
        insert_assignment(Stmp2, Sch * Sch);
        insert_assignment(Sc, Stmp2 - Stmp1);
        insert_assignment(Ss, Sch * Ssh);
        insert_assignment(Ss, Ss + Ss);
        insert_assignment(Stmp3, Stmp1 + Stmp2);
        insert_assignment(Ss22, Ss22 * Stmp3);
        insert_assignment(Ss32, Ss32 * Stmp3);
        insert_assignment(Ss21, Ss21 * Stmp3);
        insert_assignment(Ss22, Ss22 * Stmp3);
        insert_assignment(Stmp1, Ss * Ss32);
        insert_assignment(Stmp2, Ss * Ss21);
        insert_assignment(Ss32, Sc * Ss32);
        insert_assignment(Ss21, Sc * Ss21);
        insert_assignment(Ss32, Stmp2 + Ss32);
        insert_assignment(Ss21, Ss21 - Stmp1);
        insert_assignment(Stmp2, Ss * Ss);
        insert_assignment(Stmp1, Ss11 * Stmp2);
        insert_assignment(Stmp3, Ss33 * Stmp2);
        insert_assignment(Stmp4, Sc * Sc);
        insert_assignment(Ss33, Ss33 * Stmp4);
        insert_assignment(Ss11, Ss11 * Stmp4);
        insert_assignment(Ss33, Ss33 + Stmp1);
        insert_assignment(Ss11, Ss11 + Stmp3);
        insert_assignment(Stmp4, Stmp4 - Stmp2);
        insert_assignment(Stmp2, Ss31 + Ss31);
        insert_assignment(Ss31, Ss31 * Stmp4);
        insert_assignment(Stmp4, Sc * Ss);
        insert_assignment(Stmp2, Stmp2 * Stmp4);
        insert_assignment(Stmp5, Stmp5 * Stmp4);
        insert_assignment(Ss33, Ss33 + Stmp2);
        insert_assignment(Ss31, Ss31 - Stmp5);
        insert_assignment(Ss11, Ss11 - Stmp2);
        insert_assignment(Stmp1, Ssh * Sqvvx);
        insert_assignment(Stmp2, Ssh * Sqvvy);
        insert_assignment(Stmp3, Ssh * Sqvvz);
        insert_assignment(Ssh, Ssh * Sqvs);
        insert_assignment(Sqvs, Sch * Sqvs);
        insert_assignment(Sqvvx, Sch * Sqvvx);
        insert_assignment(Sqvvy, Sch * Sqvvy);
        insert_assignment(Sqvvz, Sch * Sqvvz);
        insert_assignment(Sqvvy, Sqvvy + Ssh);
        insert_assignment(Sqvs, Sqvs - Stmp2);
        insert_assignment(Sqvvz, Sqvvz + Stmp1);
        insert_assignment(Sqvvx, Sqvvx - Stmp3);
    }
    insert_assignment(Stmp2, Sqvs * Sqvs);
    insert_assignment(Stmp1, Sqvvx * Sqvvx);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, Sqvvy * Sqvvy);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, Sqvvz * Sqvvz);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Sqvs, Sqvs * Stmp1);
    insert_assignment(Sqvvx, Sqvvx * Stmp1);
    insert_assignment(Sqvvy, Sqvvy * Stmp1);
    insert_assignment(Sqvvz, Sqvvz * Stmp1);
    insert_assignment(Stmp1, Sqvvx * Sqvvx);
    insert_assignment(Stmp2, Sqvvy * Sqvvy);
    insert_assignment(Stmp3, Sqvvz * Sqvvz);
    insert_assignment(Sv11, Sqvs * Sqvs);
    insert_assignment(Sv22, Sv11 - Stmp1);
    insert_assignment(Sv33, Sv22 - Stmp2);
    insert_assignment(Sv33, Sv33 + Stmp3);
    insert_assignment(Sv22, Sv22 + Stmp2);
    insert_assignment(Sv22, Sv22 - Stmp3);
    insert_assignment(Sv11, Sv11 + Stmp1);
    insert_assignment(Sv11, Sv11 - Stmp2);
    insert_assignment(Sv11, Sv11 - Stmp3);
    insert_assignment(Stmp1, Sqvvx + Sqvvx);
    insert_assignment(Stmp2, Sqvvy + Sqvvy);
    insert_assignment(Stmp3, Sqvvz + Sqvvz);
    insert_assignment(Sv32, Sqvs * Stmp1);
    insert_assignment(Sv13, Sqvs * Stmp2);
    insert_assignment(Sv21, Sqvs * Stmp3);
    insert_assignment(Stmp1, Sqvvy * Stmp1);
    insert_assignment(Stmp2, Sqvvz * Stmp2);
    insert_assignment(Stmp3, Sqvvx * Stmp3);
    insert_assignment(Sv12, Stmp1 - Sv21);
    insert_assignment(Sv23, Stmp2 - Sv32);
    insert_assignment(Sv31, Stmp3 - Sv13);
    insert_assignment(Sv21, Stmp1 + Sv21);
    insert_assignment(Sv32, Stmp2 + Sv32);
    insert_assignment(Sv13, Stmp3 + Sv13);
    insert_assignment(Stmp2, Sa12);
    insert_assignment(Stmp3, Sa13);
    insert_assignment(Sa12, Sv12 * Sa11);
    insert_assignment(Sa13, Sv13 * Sa11);
    insert_assignment(Sa11, Sv11 * Sa11);
    insert_assignment(Stmp1, Sv21 * Stmp2);
    insert_assignment(Sa11, Sa11 + Stmp1);
    insert_assignment(Stmp1, Sv31 * Stmp3);
    insert_assignment(Sa11, Sa11 + Stmp1);
    insert_assignment(Stmp1, Sv22 * Stmp2);
    insert_assignment(Sa12, Sa12 + Stmp1);
    insert_assignment(Stmp1, Sv32 * Stmp3);
    insert_assignment(Sa12, Sa12 + Stmp1);
    insert_assignment(Stmp1, Sv23 * Stmp2);
    insert_assignment(Sa13, Sa13 + Stmp1);
    insert_assignment(Stmp1, Sv33 * Stmp3);
    insert_assignment(Sa13, Sa13 + Stmp1);
    insert_assignment(Stmp2, Sa22);
    insert_assignment(Stmp3, Sa23);
    insert_assignment(Sa22, Sv12 * Sa21);
    insert_assignment(Sa23, Sv13 * Sa21);
    insert_assignment(Sa21, Sv11 * Sa21);
    insert_assignment(Stmp1, Sv21 * Stmp2);
    insert_assignment(Sa21, Sa21 + Stmp1);
    insert_assignment(Stmp1, Sv31 * Stmp3);
    insert_assignment(Sa21, Sa21 + Stmp1);
    insert_assignment(Stmp1, Sv22 * Stmp2);
    insert_assignment(Sa22, Sa22 + Stmp1);
    insert_assignment(Stmp1, Sv32 * Stmp3);
    insert_assignment(Sa22, Sa22 + Stmp1);
    insert_assignment(Stmp1, Sv23 * Stmp2);
    insert_assignment(Sa23, Sa23 + Stmp1);
    insert_assignment(Stmp1, Sv33 * Stmp3);
    insert_assignment(Sa23, Sa23 + Stmp1);
    insert_assignment(Stmp2, Sa32);
    insert_assignment(Stmp3, Sa33);
    insert_assignment(Sa32, Sv12 * Sa31);
    insert_assignment(Sa33, Sv13 * Sa31);
    insert_assignment(Sa31, Sv11 * Sa31);
    insert_assignment(Stmp1, Sv21 * Stmp2);
    insert_assignment(Sa31, Sa31 + Stmp1);
    insert_assignment(Stmp1, Sv31 * Stmp3);
    insert_assignment(Sa31, Sa31 + Stmp1);
    insert_assignment(Stmp1, Sv22 * Stmp2);
    insert_assignment(Sa32, Sa32 + Stmp1);
    insert_assignment(Stmp1, Sv32 * Stmp3);
    insert_assignment(Sa32, Sa32 + Stmp1);
    insert_assignment(Stmp1, Sv23 * Stmp2);
    insert_assignment(Sa33, Sa33 + Stmp1);
    insert_assignment(Stmp1, Sv33 * Stmp3);
    insert_assignment(Sa33, Sa33 + Stmp1);
    insert_assignment(Stmp1, Sa11 * Sa11);
    insert_assignment(Stmp4, Sa21 * Sa21);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp4, Sa31 * Sa31);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp2, Sa12 * Sa12);
    insert_assignment(Stmp4, Sa22 * Sa22);
    insert_assignment(Stmp2, Stmp2 + Stmp4);
    insert_assignment(Stmp4, Sa32 * Sa32);
    insert_assignment(Stmp2, Stmp2 + Stmp4);
    insert_assignment(Stmp3, Sa13 * Sa13);
    insert_assignment(Stmp4, Sa23 * Sa23);
    insert_assignment(Stmp3, Stmp3 + Stmp4);
    insert_assignment(Stmp4, Sa33 * Sa33);
    insert_assignment(Stmp3, Stmp3 + Stmp4);
    insert_assignment(
        Stmp4, bitcast_f32(expr_select(
            Stmp1 < Stmp2, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa11, Sa12));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa11, svd_bitwise_xor(Sa11, Stmp5));
    insert_assignment(Sa12, svd_bitwise_xor(Sa12, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa21, Sa22));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa21, svd_bitwise_xor(Sa21, Stmp5));
    insert_assignment(Sa22, svd_bitwise_xor(Sa22, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa31, Sa32));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa31, svd_bitwise_xor(Sa31, Stmp5));
    insert_assignment(Sa32, svd_bitwise_xor(Sa32, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv11, Sv12));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv11, svd_bitwise_xor(Sv11, Stmp5));
    insert_assignment(Sv12, svd_bitwise_xor(Sv12, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv21, Sv22));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv21, svd_bitwise_xor(Sv21, Stmp5));
    insert_assignment(Sv22, svd_bitwise_xor(Sv22, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv31, Sv32));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv31, svd_bitwise_xor(Sv31, Stmp5));
    insert_assignment(Sv32, svd_bitwise_xor(Sv32, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Stmp1, Stmp2));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp1, svd_bitwise_xor(Stmp1, Stmp5));
    insert_assignment(Stmp2, svd_bitwise_xor(Stmp2, Stmp5));
    insert_assignment(Stmp5, Expr(Tf(-2.0)));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp4, Expr(Tf(1.0)));
    insert_assignment(Stmp4, Stmp4 + Stmp5);
    insert_assignment(Sa12, Sa12 * Stmp4);
    insert_assignment(Sa22, Sa22 * Stmp4);
    insert_assignment(Sa32, Sa32 * Stmp4);
    insert_assignment(Sv12, Sv12 * Stmp4);
    insert_assignment(Sv22, Sv22 * Stmp4);
    insert_assignment(Sv32, Sv32 * Stmp4);
    insert_assignment(
        Stmp4, bitcast_f32(expr_select(
            Stmp1 < Stmp3, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa11, Sa13));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa11, svd_bitwise_xor(Sa11, Stmp5));
    insert_assignment(Sa13, svd_bitwise_xor(Sa13, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa21, Sa23));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa21, svd_bitwise_xor(Sa21, Stmp5));
    insert_assignment(Sa23, svd_bitwise_xor(Sa23, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa31, Sa33));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa31, svd_bitwise_xor(Sa31, Stmp5));
    insert_assignment(Sa33, svd_bitwise_xor(Sa33, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv11, Sv13));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv11, svd_bitwise_xor(Sv11, Stmp5));
    insert_assignment(Sv13, svd_bitwise_xor(Sv13, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv21, Sv23));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv21, svd_bitwise_xor(Sv21, Stmp5));
    insert_assignment(Sv23, svd_bitwise_xor(Sv23, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv31, Sv33));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv31, svd_bitwise_xor(Sv31, Stmp5));
    insert_assignment(Sv33, svd_bitwise_xor(Sv33, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Stmp1, Stmp3));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp1, svd_bitwise_xor(Stmp1, Stmp5));
    insert_assignment(Stmp3, svd_bitwise_xor(Stmp3, Stmp5));
    insert_assignment(Stmp5, Expr(Tf(-2.0)));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp4, Expr(Tf(1.0)));
    insert_assignment(Stmp4, Stmp4 + Stmp5);
    insert_assignment(Sa11, Sa11 * Stmp4);
    insert_assignment(Sa21, Sa21 * Stmp4);
    insert_assignment(Sa31, Sa31 * Stmp4);
    insert_assignment(Sv11, Sv11 * Stmp4);
    insert_assignment(Sv21, Sv21 * Stmp4);
    insert_assignment(Sv31, Sv31 * Stmp4);
    insert_assignment(
        Stmp4, bitcast_f32(expr_select(
            Stmp2 < Stmp3, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa12, Sa13));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa12, svd_bitwise_xor(Sa12, Stmp5));
    insert_assignment(Sa13, svd_bitwise_xor(Sa13, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa22, Sa23));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa22, svd_bitwise_xor(Sa22, Stmp5));
    insert_assignment(Sa23, svd_bitwise_xor(Sa23, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sa32, Sa33));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sa32, svd_bitwise_xor(Sa32, Stmp5));
    insert_assignment(Sa33, svd_bitwise_xor(Sa33, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv12, Sv13));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv12, svd_bitwise_xor(Sv12, Stmp5));
    insert_assignment(Sv13, svd_bitwise_xor(Sv13, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv22, Sv23));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv22, svd_bitwise_xor(Sv22, Stmp5));
    insert_assignment(Sv23, svd_bitwise_xor(Sv23, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Sv32, Sv33));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Sv32, svd_bitwise_xor(Sv32, Stmp5));
    insert_assignment(Sv33, svd_bitwise_xor(Sv33, Stmp5));
    insert_assignment(Stmp5, svd_bitwise_xor(Stmp2, Stmp3));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp2, svd_bitwise_xor(Stmp2, Stmp5));
    insert_assignment(Stmp3, svd_bitwise_xor(Stmp3, Stmp5));
    insert_assignment(Stmp5, Expr(Tf(-2.0)));
    insert_assignment(Stmp5, svd_bitwise_and(Stmp5, Stmp4));
    insert_assignment(Stmp4, Expr(Tf(1.0)));
    insert_assignment(Stmp4, Stmp4 + Stmp5);
    insert_assignment(Sa13, Sa13 * Stmp4);
    insert_assignment(Sa23, Sa23 * Stmp4);
    insert_assignment(Sa33, Sa33 * Stmp4);
    insert_assignment(Sv13, Sv13 * Stmp4);
    insert_assignment(Sv23, Sv23 * Stmp4);
    insert_assignment(Sv33, Sv33 * Stmp4);
    insert_assignment(Su11, Expr(Tf(1.0)));
    insert_assignment(Su21, Expr(Tf(0.0)));
    insert_assignment(Su31, Expr(Tf(0.0)));
    insert_assignment(Su12, Expr(Tf(0.0)));
    insert_assignment(Su22, Expr(Tf(1.0)));
    insert_assignment(Su32, Expr(Tf(0.0)));
    insert_assignment(Su13, Expr(Tf(0.0)));
    insert_assignment(Su23, Expr(Tf(0.0)));
    insert_assignment(Su33, Expr(Tf(1.0)));
    insert_assignment(Ssh, Sa21 * Sa21);
    insert_assignment(
        Ssh, bitcast_f32(expr_select(Ssh >= Ssmall_number,
            Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Ssh, svd_bitwise_and(Ssh, Sa21));
    insert_assignment(Stmp5, Expr(Tf(0.0)));
    insert_assignment(Sch, Stmp5 - Sa11);
    insert_assignment(Sch, ti.max(Sch, Sa11));
    insert_assignment(Sch, ti.max(Sch, Ssmall_number));
    insert_assignment(
        Stmp5, bitcast_f32(expr_select(
            Sa11 >= Stmp5, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Stmp1, Stmp1 * Stmp2);
    insert_assignment(Sch, Sch + Stmp1);
    insert_assignment(
        Stmp1, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Ssh));
    insert_assignment(
        Stmp2, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Sch));
    insert_assignment(Sch, svd_bitwise_and(Stmp5, Sch));
    insert_assignment(Ssh, svd_bitwise_and(Stmp5, Ssh));
    insert_assignment(Sch, svd_bitwise_or(Sch, Stmp1));
    insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Sch, Sch * Stmp1);
    insert_assignment(Ssh, Ssh * Stmp1);
    insert_assignment(Sc, Sch * Sch);
    insert_assignment(Ss, Ssh * Ssh);
    insert_assignment(Sc, Sc - Ss);
    insert_assignment(Ss, Ssh * Sch);
    insert_assignment(Ss, Ss + Ss);
    insert_assignment(Stmp1, Ss * Sa11);
    insert_assignment(Stmp2, Ss * Sa21);
    insert_assignment(Sa11, Sc * Sa11);
    insert_assignment(Sa21, Sc * Sa21);
    insert_assignment(Sa11, Sa11 + Stmp2);
    insert_assignment(Sa21, Sa21 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa12);
    insert_assignment(Stmp2, Ss * Sa22);
    insert_assignment(Sa12, Sc * Sa12);
    insert_assignment(Sa22, Sc * Sa22);
    insert_assignment(Sa12, Sa12 + Stmp2);
    insert_assignment(Sa22, Sa22 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa13);
    insert_assignment(Stmp2, Ss * Sa23);
    insert_assignment(Sa13, Sc * Sa13);
    insert_assignment(Sa23, Sc * Sa23);
    insert_assignment(Sa13, Sa13 + Stmp2);
    insert_assignment(Sa23, Sa23 - Stmp1);
    insert_assignment(Stmp1, Ss * Su11);
    insert_assignment(Stmp2, Ss * Su12);
    insert_assignment(Su11, Sc * Su11);
    insert_assignment(Su12, Sc * Su12);
    insert_assignment(Su11, Su11 + Stmp2);
    insert_assignment(Su12, Su12 - Stmp1);
    insert_assignment(Stmp1, Ss * Su21);
    insert_assignment(Stmp2, Ss * Su22);
    insert_assignment(Su21, Sc * Su21);
    insert_assignment(Su22, Sc * Su22);
    insert_assignment(Su21, Su21 + Stmp2);
    insert_assignment(Su22, Su22 - Stmp1);
    insert_assignment(Stmp1, Ss * Su31);
    insert_assignment(Stmp2, Ss * Su32);
    insert_assignment(Su31, Sc * Su31);
    insert_assignment(Su32, Sc * Su32);
    insert_assignment(Su31, Su31 + Stmp2);
    insert_assignment(Su32, Su32 - Stmp1);
    insert_assignment(Ssh, Sa31 * Sa31);
    insert_assignment(
        Ssh, bitcast_f32(expr_select(Ssh >= Ssmall_number,
            Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Ssh, svd_bitwise_and(Ssh, Sa31));
    insert_assignment(Stmp5, Expr(Tf(0.0)));
    insert_assignment(Sch, Stmp5 - Sa11);
    insert_assignment(Sch, ti.max(Sch, Sa11));
    insert_assignment(Sch, ti.max(Sch, Ssmall_number));
    insert_assignment(
        Stmp5, bitcast_f32(expr_select(
            Sa11 >= Stmp5, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Stmp1, Stmp1 * Stmp2);
    insert_assignment(Sch, Sch + Stmp1);
    insert_assignment(
        Stmp1, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Ssh));
    insert_assignment(
        Stmp2, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Sch));
    insert_assignment(Sch, svd_bitwise_and(Stmp5, Sch));
    insert_assignment(Ssh, svd_bitwise_and(Stmp5, Ssh));
    insert_assignment(Sch, svd_bitwise_or(Sch, Stmp1));
    insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Sch, Sch * Stmp1);
    insert_assignment(Ssh, Ssh * Stmp1);
    insert_assignment(Sc, Sch * Sch);
    insert_assignment(Ss, Ssh * Ssh);
    insert_assignment(Sc, Sc - Ss);
    insert_assignment(Ss, Ssh * Sch);
    insert_assignment(Ss, Ss + Ss);
    insert_assignment(Stmp1, Ss * Sa11);
    insert_assignment(Stmp2, Ss * Sa31);
    insert_assignment(Sa11, Sc * Sa11);
    insert_assignment(Sa31, Sc * Sa31);
    insert_assignment(Sa11, Sa11 + Stmp2);
    insert_assignment(Sa31, Sa31 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa12);
    insert_assignment(Stmp2, Ss * Sa32);
    insert_assignment(Sa12, Sc * Sa12);
    insert_assignment(Sa32, Sc * Sa32);
    insert_assignment(Sa12, Sa12 + Stmp2);
    insert_assignment(Sa32, Sa32 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa13);
    insert_assignment(Stmp2, Ss * Sa33);
    insert_assignment(Sa13, Sc * Sa13);
    insert_assignment(Sa33, Sc * Sa33);
    insert_assignment(Sa13, Sa13 + Stmp2);
    insert_assignment(Sa33, Sa33 - Stmp1);
    insert_assignment(Stmp1, Ss * Su11);
    insert_assignment(Stmp2, Ss * Su13);
    insert_assignment(Su11, Sc * Su11);
    insert_assignment(Su13, Sc * Su13);
    insert_assignment(Su11, Su11 + Stmp2);
    insert_assignment(Su13, Su13 - Stmp1);
    insert_assignment(Stmp1, Ss * Su21);
    insert_assignment(Stmp2, Ss * Su23);
    insert_assignment(Su21, Sc * Su21);
    insert_assignment(Su23, Sc * Su23);
    insert_assignment(Su21, Su21 + Stmp2);
    insert_assignment(Su23, Su23 - Stmp1);
    insert_assignment(Stmp1, Ss * Su31);
    insert_assignment(Stmp2, Ss * Su33);
    insert_assignment(Su31, Sc * Su31);
    insert_assignment(Su33, Sc * Su33);
    insert_assignment(Su31, Su31 + Stmp2);
    insert_assignment(Su33, Su33 - Stmp1);
    insert_assignment(Ssh, Sa32 * Sa32);
    insert_assignment(
        Ssh, bitcast_f32(expr_select(Ssh >= Ssmall_number,
            Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Ssh, svd_bitwise_and(Ssh, Sa32));
    insert_assignment(Stmp5, Expr(Tf(0.0)));
    insert_assignment(Sch, Stmp5 - Sa22);
    insert_assignment(Sch, ti.max(Sch, Sa22));
    insert_assignment(Sch, ti.max(Sch, Ssmall_number));
    insert_assignment(
        Stmp5, bitcast_f32(expr_select(
            Sa22 >= Stmp5, Expr(Ti(int32(xffffffff))), Expr(Ti(0)))));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Stmp1, Stmp1 * Stmp2);
    insert_assignment(Sch, Sch + Stmp1);
    insert_assignment(
        Stmp1, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Ssh));
    insert_assignment(
        Stmp2, svd_bitwise_and(Expr(~bitcast_i32(Stmp5)), Sch));
    insert_assignment(Sch, svd_bitwise_and(Stmp5, Sch));
    insert_assignment(Ssh, svd_bitwise_and(Stmp5, Ssh));
    insert_assignment(Sch, svd_bitwise_or(Sch, Stmp1));
    insert_assignment(Ssh, svd_bitwise_or(Ssh, Stmp2));
    insert_assignment(Stmp1, Sch * Sch);
    insert_assignment(Stmp2, Ssh * Ssh);
    insert_assignment(Stmp2, Stmp1 + Stmp2);
    insert_assignment(Stmp1, rsqrt(Stmp2));
    insert_assignment(Stmp4, Stmp1 * Sone_half);
    insert_assignment(Stmp3, Stmp1 * Stmp4);
    insert_assignment(Stmp3, Stmp1 * Stmp3);
    insert_assignment(Stmp3, Stmp2 * Stmp3);
    insert_assignment(Stmp1, Stmp1 + Stmp4);
    insert_assignment(Stmp1, Stmp1 - Stmp3);
    insert_assignment(Sch, Sch * Stmp1);
    insert_assignment(Ssh, Ssh * Stmp1);
    insert_assignment(Sc, Sch * Sch);
    insert_assignment(Ss, Ssh * Ssh);
    insert_assignment(Sc, Sc - Ss);
    insert_assignment(Ss, Ssh * Sch);
    insert_assignment(Ss, Ss + Ss);
    insert_assignment(Stmp1, Ss * Sa21);
    insert_assignment(Stmp2, Ss * Sa31);
    insert_assignment(Sa21, Sc * Sa21);
    insert_assignment(Sa31, Sc * Sa31);
    insert_assignment(Sa21, Sa21 + Stmp2);
    insert_assignment(Sa31, Sa31 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa22);
    insert_assignment(Stmp2, Ss * Sa32);
    insert_assignment(Sa22, Sc * Sa22);
    insert_assignment(Sa32, Sc * Sa32);
    insert_assignment(Sa22, Sa22 + Stmp2);
    insert_assignment(Sa32, Sa32 - Stmp1);
    insert_assignment(Stmp1, Ss * Sa23);
    insert_assignment(Stmp2, Ss * Sa33);
    insert_assignment(Sa23, Sc * Sa23);
    insert_assignment(Sa33, Sc * Sa33);
    insert_assignment(Sa23, Sa23 + Stmp2);
    insert_assignment(Sa33, Sa33 - Stmp1);
    insert_assignment(Stmp1, Ss * Su12);
    insert_assignment(Stmp2, Ss * Su13);
    insert_assignment(Su12, Sc * Su12);
    insert_assignment(Su13, Sc * Su13);
    insert_assignment(Su12, Su12 + Stmp2);
    insert_assignment(Su13, Su13 - Stmp1);
    insert_assignment(Stmp1, Ss * Su22);
    insert_assignment(Stmp2, Ss * Su23);
    insert_assignment(Su22, Sc * Su22);
    insert_assignment(Su23, Sc * Su23);
    insert_assignment(Su22, Su22 + Stmp2);
    insert_assignment(Su23, Su23 - Stmp1);
    insert_assignment(Stmp1, Ss * Su32);
    insert_assignment(Stmp2, Ss * Su33);
    insert_assignment(Su32, Sc * Su32);
    insert_assignment(Su33, Sc * Su33);
    insert_assignment(Su32, Su32 + Stmp2);
    insert_assignment(Su33, Su33 - Stmp1);

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

class LibraryFunc {
    constructor(public name:string, public numArgs:number, public code:string){

    }

    public static getLibraryFuncs():Map<string,LibraryFunc>{
        let funcs:LibraryFunc[] = [
            new LibraryFunc("polarDecompose2D", 3,polar2dCode),
            new LibraryFunc("svd2D", 4, svd2dCode),
            new LibraryFunc("svd3D", 4, svd3dCode),
            new LibraryFunc("lookAt", 3, lookAtCode),
            new LibraryFunc("perspective", 4, perspectiveCode),
        ]

        let funcsMap = new Map<string,LibraryFunc>()
        for(let f of funcs){
            funcsMap.set(f.name,f)
        }
        return funcsMap
    }
}



export {LibraryFunc}