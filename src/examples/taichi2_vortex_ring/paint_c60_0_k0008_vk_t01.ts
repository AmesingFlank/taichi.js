
export const shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let begine_xpr_value: i32 = 0;

let totale_lems: i32 = 200000;

let tmp2443_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp2622_: i32 = 0;

let tmp2552_: i32 = 262143;

let tmp28_: f32 = 0.10000000149011612;

let tmp30_: f32 = 0.5;

let tmp32_: f32 = 51.20000076293945;

let tmp34_: f32 = 512.0;

let tmp39_: f32 = 0.0;

let tmp2560_: i32 = 1023;

let tmp2564_: i32 = 511;

let tmp2678_: i32 = 9;

let tmp46_: f32 = 1.0;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;

    let e_34 = global[tmp2443_];
    phi_29_ = (bitcast<i32>(e_34) + begine_xpr_value);
    loop {
        let e_39 = phi_29_;
        if ((e_39 < (totale_lems + begine_xpr_value))) {
            let e_44 = (tmp2443_ + (bitcast<u32>(tmp2622_) * 10485840u));
            let e_49 = ((e_44 + 8388688u) + (bitcast<u32>(((e_39 + 0) & tmp2552_)) * 8u));
            let e_55 = root_buffer_0_.member[((e_49 + tmp2443_) >> bitcast<u32>(2u))];
            let e_62 = root_buffer_0_.member[((e_49 + 4u) >> bitcast<u32>(2u))];
            let e_78 = ((e_44 + tmp2443_) + (bitcast<u32>(((i32((((bitcast<f32>(e_62) * tmp28_) + tmp30_) * tmp34_)) & tmp2564_) + ((i32((bitcast<f32>(e_55) * tmp32_)) & tmp2560_) << bitcast<u32>(tmp2678_)))) * 16u));
            root_buffer_0_.member[((e_78 + tmp2443_) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 4u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 8u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 12u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp46_);

            root_buffer_0_.member[((e_78 + tmp2443_) >> bitcast<u32>(2u))] = bitcast<i32>(0.0);
            root_buffer_0_.member[((e_78 + 4u) >> bitcast<u32>(2u))] = bitcast<i32>(0.0);
            root_buffer_0_.member[((e_78 + 8u) >> bitcast<u32>(2u))] = bitcast<i32>(0.0);
            root_buffer_0_.member[((e_78 + 12u) >> bitcast<u32>(2u))] = bitcast<i32>(0.0);
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_39 + total_invocs);
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
            