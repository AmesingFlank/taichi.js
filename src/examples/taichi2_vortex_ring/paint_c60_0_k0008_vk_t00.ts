
export const shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 524288;

let tmp2396_: u32 = 0u;

let total_invocs: i32 = 524288;

let tmp2510_: i32 = 9;

let tmp2674_: i32 = 1023;

let tmp2675_: i32 = 511;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    var phi_29_: i32;

    let e_23 = global[tmp2396_];
    phi_29_ = bitcast<i32>(e_23);
    loop {
        let e_26 = phi_29_;
        if ((e_26 < totale_lems)) {
            continue;
        } else {
            break;
        }
        continuing {
            let e_36 = (bitcast<u32>(((e_26 & tmp2675_) + (((e_26 >> bitcast<u32>(tmp2510_)) & tmp2674_) << bitcast<u32>(tmp2510_)))) * 16u);
            root_buffer_0_.member[(e_36 >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 4u) >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 8u) >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 12u) >> bitcast<u32>(2u))] = 1065353216;
            phi_29_ = (e_26 + total_invocs);
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
            