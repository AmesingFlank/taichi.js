export const shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let total_elems: i32 = 10;

let tmp665_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp674_: i32 = 0;

let tmp676_: i32 = 15;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    var phi_29_: i32;

    let e18 = global[tmp665_];
    phi_29_ = bitcast<i32>(e18);
    loop {
        let e21 = phi_29_;
        if ((e21 < total_elems)) {
            continue;
        } else {
            break;
        }
        continuing {
            root_buffer_0_.member[((bitcast<u32>(((e21 >> bitcast<u32>(tmp674_)) & tmp676_)) * 4u) >> bitcast<u32>(2u))] = e21;
            phi_29_ = (e21 + total_invocs);
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