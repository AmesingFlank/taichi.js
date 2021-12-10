
export const shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let begine_xpr_value: i32 = 0;

let totale_lems: i32 = 4;

let tmp2035_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp2171_: i32 = 0;

let tmp2112_: i32 = 3;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;

    let e_24 = global[tmp2035_];
    phi_29_ = (bitcast<i32>(e_24) + begine_xpr_value);
    loop {
        let e_29 = phi_29_;
        if ((e_29 < (totale_lems + begine_xpr_value))) {
            let e_34 = (tmp2035_ + (bitcast<u32>(tmp2171_) * 10485840u));
            let e_36 = ((e_29 + 0) & tmp2112_);
            let e_39 = ((e_34 + 8388640u) + (bitcast<u32>(e_36) * 8u));
            let e_45 = root_buffer_0_.member[((e_39 + tmp2035_) >> bitcast<u32>(2u))];
            let e_50 = ((e_34 + 8388608u) + (bitcast<u32>(e_36) * 8u));
            root_buffer_0_.member[((e_50 + tmp2035_) >> bitcast<u32>(2u))] = bitcast<i32>(bitcast<f32>(e_45));
            let e_62 = root_buffer_0_.member[((e_39 + 4u) >> bitcast<u32>(2u))];
            root_buffer_0_.member[((e_50 + 4u) >> bitcast<u32>(2u))] = bitcast<i32>(bitcast<f32>(e_62));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_29 + total_invocs);
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
            