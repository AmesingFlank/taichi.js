
export const shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 200000;

let tmp131_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp4_: f32 = 0.5;

let tmp8_: f32 = 1.5;

let tmp152_: i32 = 262143;

var<private> global: vec3<u32>;
// [[group(0), binding(2)]]
// var<storage, read_write> global_tmps_buffer: type_8;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_136_: u32;
    var phi_135_: u32;
    var phi_134_: u32;
    var phi_133_: u32;
    var phi_29_: i32;

    let e_38 = global[tmp131_];
    // let e_39 = global_tmps_buffer.member[1024];
    // let e_46 = global_tmps_buffer.member[1024];
    // global_tmps_buffer.member[1024] = (e_46 + 1);
    let e_39 = 0;
    phi_136_ = 88675123u;
    phi_135_ = 521288629u;
    phi_134_ = 362436069u;
    phi_133_ = (((7654321u + e_38) * (1234567u + (9723451u * bitcast<u32>(e_39)))) * 3640077715u);
    phi_29_ = bitcast<i32>(e_38);
    loop {
        let e_50 = phi_136_;
        let e_52 = phi_135_;
        let e_54 = phi_134_;
        let e_56 = phi_133_;
        let e_58 = phi_29_;
        if ((e_58 < totale_lems)) {
            continue;
        } else {
            break;
        }
        continuing {
            let e_62 = (e_56 ^ (e_56 << bitcast<u32>(11u)));
            let e_69 = ((e_50 ^ (e_50 >> bitcast<u32>(19u))) ^ (e_62 ^ (e_62 >> bitcast<u32>(8u))));
            let e_75 = (e_54 ^ (e_54 << bitcast<u32>(11u)));
            let e_82 = ((e_69 ^ (e_69 >> bitcast<u32>(19u))) ^ (e_75 ^ (e_75 >> bitcast<u32>(8u))));
            let e_90 = (bitcast<u32>((e_58 & tmp152_)) * 8u);
            root_buffer_0_.member[((8388688u + e_90) >> bitcast<u32>(2u))] = bitcast<i32>(((f32((e_69 * 1000000007u)) * 0.00000000023283064365386963) - tmp4_));
            root_buffer_0_.member[((e_90 + 8388692u) >> bitcast<u32>(2u))] = bitcast<i32>(((f32((e_82 * 1000000007u)) * 0.0000000006984919309616089) - tmp8_));
            phi_136_ = e_82;
            phi_135_ = e_69;
            phi_134_ = e_50;
            phi_133_ = e_52;
            phi_29_ = (e_58 + total_invocs);
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
            