
export const shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 200000;

let tmp1294_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp1485_: i32 = 3;

let tmp1_: f32 = 1.0;

let tmp3_: f32 = 0.5;

let tmp4_: f32 = 3.1415927410125732;

let tmp1503_: i32 = 0;

let tmp1445_: i32 = 262143;

let tmp13_: i32 = 4;

let tmp51_: f32 = 0.05000000074505806;

let tmp95_: f32 = 0.07500000298023224;

let tmp138_: f32 = 0.2222222238779068;

let tmp143_: f32 = 0.3333333432674408;

let tmp150_: f32 = 0.4444444477558136;

let tmp156_: f32 = 0.10000000149011612;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;
    var phi_298_: f32;
    var phi_297_: f32;
    var phi_76_: i32;
    var local: f32;
    var local_1: f32;
    var phi_300_: f32;
    var phi_299_: f32;
    var phi_144_: i32;
    var local_2: f32;
    var local_3: f32;
    var phi_308_: f32;
    var phi_307_: f32;
    var phi_210_: i32;
    var local_4: f32;
    var local_5: f32;
    var local_6: f32;
    var local_7: f32;
    var local_8: f32;
    var local_9: f32;

    let e_38 = global[tmp1294_];
    phi_29_ = bitcast<i32>(e_38);
    loop {
        let e_41 = phi_29_;
        if ((e_41 < totale_lems)) {
            let e_45 = (bitcast<u32>((e_41 & tmp1445_)) * 8u);
            let e_51 = root_buffer_0_.member[((8388688u + e_45) >> bitcast<u32>(2u))];
            let e_52 = bitcast<f32>(e_51);
            let e_58 = root_buffer_0_.member[((e_45 + 8388692u) >> bitcast<u32>(2u))];
            let e_59 = bitcast<f32>(e_58);
            phi_298_ = 0.0;
            phi_297_ = 0.0;
            phi_76_ = tmp1503_;
            loop {
                let e_61 = phi_298_;
                let e_63 = phi_297_;
                let e_65 = phi_76_;
                local = e_63;
                local_1 = e_61;
                local_4 = e_63;
                local_5 = e_61;
                if ((e_65 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_68 = bitcast<u32>((e_65 & tmp1485_));
                    let e_69 = (e_68 * 8u);
                    let e_75 = root_buffer_0_.member[((8388608u + e_69) >> bitcast<u32>(2u))];
                    let e_77 = (e_52 - bitcast<f32>(e_75));
                    let e_83 = root_buffer_0_.member[((e_69 + 8388612u) >> bitcast<u32>(2u))];
                    let e_84 = bitcast<f32>(e_83);
                    let e_85 = (e_59 - e_84);
                    let e_89 = sqrt(((e_77 * e_77) + (e_85 * e_85)));
                    let e_90 = (e_89 * e_89);
                    let e_98 = root_buffer_0_.member[((8388672u + (e_68 * 4u)) >> bitcast<u32>(2u))];
                    let e_99 = bitcast<f32>(e_98);
                    let e_102 = (e_90 * tmp4_);
                    let e_109 = (tmp1_ - exp((e_90 * -10000.0)));
                    phi_298_ = (e_61 + ((((e_99 * e_77) / e_102) * tmp3_) * e_109));
                    phi_297_ = (e_63 + ((((e_99 * (e_84 - e_59)) / e_102) * tmp3_) * e_109));
                    phi_76_ = (e_65 + 1);
                }
            }
            let e_116 = local;
            let e_119 = local_1;
            let e_122 = (e_59 + (e_119 * tmp51_));
            phi_300_ = 0.0;
            phi_299_ = 0.0;
            phi_144_ = tmp1503_;
            loop {
                let e_124 = phi_300_;
                let e_126 = phi_299_;
                let e_128 = phi_144_;
                local_2 = e_126;
                local_3 = e_124;
                local_6 = e_126;
                local_7 = e_124;
                if ((e_128 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_131 = bitcast<u32>((e_128 & tmp1485_));
                    let e_132 = (e_131 * 8u);
                    let e_138 = root_buffer_0_.member[((8388608u + e_132) >> bitcast<u32>(2u))];
                    let e_140 = ((e_52 + (e_116 * tmp51_)) - bitcast<f32>(e_138));
                    let e_146 = root_buffer_0_.member[((e_132 + 8388612u) >> bitcast<u32>(2u))];
                    let e_147 = bitcast<f32>(e_146);
                    let e_148 = (e_122 - e_147);
                    let e_152 = sqrt(((e_140 * e_140) + (e_148 * e_148)));
                    let e_153 = (e_152 * e_152);
                    let e_161 = root_buffer_0_.member[((8388672u + (e_131 * 4u)) >> bitcast<u32>(2u))];
                    let e_162 = bitcast<f32>(e_161);
                    let e_165 = (e_153 * tmp4_);
                    let e_172 = (tmp1_ - exp((e_153 * -10000.0)));
                    phi_300_ = (e_124 + ((((e_162 * e_140) / e_165) * tmp3_) * e_172));
                    phi_299_ = (e_126 + ((((e_162 * (e_147 - e_122)) / e_165) * tmp3_) * e_172));
                    phi_144_ = (e_128 + 1);
                }
            }
            let e_179 = local_2;
            let e_182 = local_3;
            let e_185 = (e_59 + (e_182 * tmp95_));
            phi_308_ = 0.0;
            phi_307_ = 0.0;
            phi_210_ = tmp1503_;
            loop {
                let e_187 = phi_308_;
                let e_189 = phi_307_;
                let e_191 = phi_210_;
                local_8 = e_189;
                local_9 = e_187;
                if ((e_191 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_194 = bitcast<u32>((e_191 & tmp1485_));
                    let e_195 = (e_194 * 8u);
                    let e_201 = root_buffer_0_.member[((8388608u + e_195) >> bitcast<u32>(2u))];
                    let e_203 = ((e_52 + (e_179 * tmp95_)) - bitcast<f32>(e_201));
                    let e_209 = root_buffer_0_.member[((e_195 + 8388612u) >> bitcast<u32>(2u))];
                    let e_210 = bitcast<f32>(e_209);
                    let e_211 = (e_185 - e_210);
                    let e_215 = sqrt(((e_203 * e_203) + (e_211 * e_211)));
                    let e_216 = (e_215 * e_215);
                    let e_224 = root_buffer_0_.member[((8388672u + (e_194 * 4u)) >> bitcast<u32>(2u))];
                    let e_225 = bitcast<f32>(e_224);
                    let e_228 = (e_216 * tmp4_);
                    let e_235 = (tmp1_ - exp((e_216 * -10000.0)));
                    phi_308_ = (e_187 + ((((e_225 * e_203) / e_228) * tmp3_) * e_235));
                    phi_307_ = (e_189 + ((((e_225 * (e_210 - e_185)) / e_228) * tmp3_) * e_235));
                    phi_210_ = (e_191 + 1);
                }
            }
            let e_242 = local_4;
            let e_245 = local_5;
            let e_248 = local_6;
            let e_251 = local_7;
            let e_256 = local_8;
            let e_259 = local_9;
            root_buffer_0_.member[((8388688u + e_45) >> bitcast<u32>(2u))] = bitcast<i32>((e_52 + ((((e_242 * tmp138_) + (e_248 * tmp143_)) + (e_256 * tmp150_)) * tmp156_)));
            root_buffer_0_.member[((e_45 + 8388692u) >> bitcast<u32>(2u))] = bitcast<i32>((e_59 + ((((e_245 * tmp138_) + (e_251 * tmp143_)) + (e_259 * tmp150_)) * tmp156_)));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_41 + total_invocs);
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
            