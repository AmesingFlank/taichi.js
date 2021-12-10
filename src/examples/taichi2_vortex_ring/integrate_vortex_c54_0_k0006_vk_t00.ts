
export const shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 4;

let tmp1995_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp2092_: i32 = 3;

let tmp1_: f32 = 1.0;

let tmp3_: f32 = 0.5;

let tmp4_: f32 = 3.1415927410125732;

let tmp5_: i32 = 1;

let tmp9_: i32 = 0;

let tmp10_: i32 = 4;

let tmp54_: f32 = 0.10000000149011612;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;
    var phi_180_: f32;
    var phi_179_: f32;
    var phi_48_: i32;
    var phi_182_: f32;
    var phi_181_: f32;
    var local: f32;
    var local_1: f32;
    var local_2: f32;
    var local_3: f32;

    let e_33 = global[tmp1995_];
    phi_29_ = bitcast<i32>(e_33);
    loop {
        let e_36 = phi_29_;
        if ((e_36 < totale_lems)) {
            phi_180_ = 0.0;
            phi_179_ = 0.0;
            phi_48_ = tmp9_;
            loop {
                let e_39 = phi_180_;
                let e_41 = phi_179_;
                let e_43 = phi_48_;
                local = e_41;
                local_1 = e_39;
                if ((e_43 < tmp10_)) {
                    if (((-(select(0, 1, (e_36 != e_43))) & tmp5_) != 0)) {
                        let e_52 = (bitcast<u32>((e_36 & tmp2092_)) * 8u);
                        let e_58 = root_buffer_0_.member[((8388608u + e_52) >> bitcast<u32>(2u))];
                        let e_65 = root_buffer_0_.member[((e_52 + 8388612u) >> bitcast<u32>(2u))];
                        let e_66 = bitcast<f32>(e_65);
                        let e_68 = bitcast<u32>((e_43 & tmp2092_));
                        let e_69 = (e_68 * 8u);
                        let e_75 = root_buffer_0_.member[((8388608u + e_69) >> bitcast<u32>(2u))];
                        let e_77 = (bitcast<f32>(e_58) - bitcast<f32>(e_75));
                        let e_83 = root_buffer_0_.member[((e_69 + 8388612u) >> bitcast<u32>(2u))];
                        let e_84 = bitcast<f32>(e_83);
                        let e_85 = (e_66 - e_84);
                        let e_89 = sqrt(((e_77 * e_77) + (e_85 * e_85)));
                        let e_90 = (e_89 * e_89);
                        let e_98 = root_buffer_0_.member[((8388672u + (e_68 * 4u)) >> bitcast<u32>(2u))];
                        let e_99 = bitcast<f32>(e_98);
                        let e_102 = (e_90 * tmp4_);
                        let e_109 = (tmp1_ - exp((e_90 * -10000.0)));
                        phi_182_ = (e_39 + ((((e_99 * e_77) / e_102) * tmp3_) * e_109));
                        phi_181_ = (e_41 + ((((e_99 * (e_84 - e_66)) / e_102) * tmp3_) * e_109));
                    } else {
                        phi_182_ = e_39;
                        phi_181_ = e_41;
                    }
                    let e_115 = phi_182_;
                    let e_117 = phi_181_;
                    local_2 = e_115;
                    local_3 = e_117;
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_160 = local_2;
                    phi_180_ = e_160;
                    let e_163 = local_3;
                    phi_179_ = e_163;
                    phi_48_ = (e_43 + 1);
                }
            }
            let e_120 = local;
            let e_123 = local_1;
            let e_127 = (bitcast<u32>((e_36 & tmp2092_)) * 8u);
            let e_133 = root_buffer_0_.member[((8388608u + e_127) >> bitcast<u32>(2u))];
            let e_141 = root_buffer_0_.member[((e_127 + 8388612u) >> bitcast<u32>(2u))];
            root_buffer_0_.member[((8388640u + e_127) >> bitcast<u32>(2u))] = bitcast<i32>((bitcast<f32>(e_133) + (e_120 * tmp54_)));
            root_buffer_0_.member[((e_127 + 8388644u) >> bitcast<u32>(2u))] = bitcast<i32>((bitcast<f32>(e_141) + (e_123 * tmp54_)));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_36 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`
            