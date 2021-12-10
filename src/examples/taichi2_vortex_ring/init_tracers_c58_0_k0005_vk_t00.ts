
export const shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let tmp234_: u32 = 0u;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    let e_27 = global[tmp234_];
    if ((bitcast<i32>(e_27) == bitcast<i32>(tmp234_))) {
        root_buffer_0_.member[2097152u] = 0;
        root_buffer_0_.member[2097153u] = 1065353216;
        root_buffer_0_.member[2097154u] = 0;
        root_buffer_0_.member[2097155u] = -1082130432;
        root_buffer_0_.member[2097156u] = 0;
        root_buffer_0_.member[2097157u] = 1050253722;
        root_buffer_0_.member[2097158u] = 0;
        root_buffer_0_.member[2097159u] = -1097229926;
        root_buffer_0_.member[2097168u] = 1065353216;
        root_buffer_0_.member[2097169u] = -1082130432;
        root_buffer_0_.member[2097170u] = 1065353216;
        root_buffer_0_.member[2097171u] = -1082130432;
    }
    return;
}

[[stage(compute), workgroup_size(1, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`
            