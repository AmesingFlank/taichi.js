import * as ti from "../../dist/taichi.js"
let main = async () => {
    await ti.init();

    let res = [800, 800];
    let color_buffer = ti.Vector.field(3, ti.f32, res);
    let count_var = ti.field(ti.i32, [1]);
    let tonemapped_buffer = ti.Vector.field(4, ti.f32, res);
    let max_ray_depth = 10;
    let eps = 1e-4;
    let inf = 1e9;
    let fov = 0.8;
    let camera_pos = [0.0, 0.6, 3.0];

    let mat_none = 0;
    let mat_lambertian = 1;
    let mat_specular = 2;
    let mat_glass = 3;
    let mat_light = 4;

    let light_y_pos = 2.0 - eps;
    let light_x_min_pos = -0.25;
    let light_x_range = 0.5;
    let light_z_min_pos = 1.0;
    let light_z_range = 0.12;
    let light_area = light_x_range * light_z_range;
    let light_min_pos = [light_x_min_pos, light_y_pos, light_z_min_pos];
    let light_max_pos = [
        light_x_min_pos + light_x_range,
        light_y_pos,
        light_z_min_pos + light_z_range,
    ];
    let light_color = [0.9, 0.85, 0.7];
    let light_normal = [0.0, -1.0, 0.0];

    // No absorbtion, integrates over a unit hemisphere
    let lambertian_brdf = 1.0 / Math.PI;
    // diamond!
    let refr_idx = 2.4;

    // right sphere
    let sp1_center = [0.4, 0.225, 1.75];
    let sp1_radius = 0.22;

    let box_min = [0.0, 0.0, 0.0];
    let box_max = [0.55, 1.1, 0.55];
    let box_m_inv = [
        [0.92387953, 0, -0.38268343, 0.91459408],
        [0, 1, 0, 0],
        [0.38268343, 0, 0.92387953, -0.37883727],
        [0, 0, 0, 1],
    ];
    let box_m_inv_t = [
        [0.92387953, 0, 0.38268343, 0],
        [0, 1, 0, 0],
        [-0.38268343, 0, 0.92387953, 0],
        [0.91459408, 0, -0.37883727, 1],
    ];

    let stratify_res = 5;
    let inv_stratify = 1.0 / 5.0;

    ti.addToKernelScope({
        res,
        color_buffer,
        count_var,
        tonemapped_buffer,
        max_ray_depth,
        eps,
        inf,
        fov,
        camera_pos,
        mat_none,
        mat_glass,
        mat_lambertian,
        mat_light,
        mat_specular,
        light_y_pos,
        light_x_min_pos,
        light_x_range,
        light_z_min_pos,
        light_z_range,
        light_area,
        light_min_pos,
        light_max_pos,
        light_color,
        light_normal,
        lambertian_brdf,
        refr_idx,
        sp1_center,
        sp1_radius,
        box_min,
        box_max,
        box_m_inv,
        box_m_inv_t,
        stratify_res,
        inv_stratify,
    });

    let reflect = (d, n) => {
        // Assuming |d| and |n| are normalized
        return d - 2.0 * d.dot(n) * n;
    };

    let refract = (d, n, ni_over_nt) => {
        // Assuming |d| and |n| are normalized
        let has_r = 0;
        let rd = d;
        let dt = d.dot(n);
        let discr = 1.0 - ni_over_nt * ni_over_nt * (1.0 - dt * dt);
        if (discr > 0.0) {
            has_r = 1;
            rd = (ni_over_nt * (d - n * dt) - n * ti.sqrt(discr)).normalized();
        } else {
            rd = 0.0;
        }
        return rd;
    };

    let mat_mul_point = (m, p) => {
        let hp = [p[0], p[1], p[2], 1.0];
        hp = m.matmul(hp);
        return hp.xyz / hp.w;
    };

    let mat_mul_vec = (m, v) => {
        let hv = [v[0], v[1], v[2], 0.0];
        hv = m.matmul(hv);
        return hv.xyz;
    };

    let intersect_sphere = (pos, d, center, radius, hit_pos) => {
        let T = pos - center;
        let A = 1.0;
        let B = 2.0 * T.dot(d);
        let C = T.dot(T) - radius * radius;
        let delta = B * B - 4.0 * A * C;
        let dist = f32(inf);
        hit_pos = [0.0, 0.0, 0.0];

        if (delta > -1e-4) {
            delta = ti.max(delta, 0);
            let sdelta = ti.sqrt(delta);
            let ratio = 0.5 / A;
            let ret1 = ratio * (-B - sdelta);
            dist = ret1;
            if (dist < inf) {
                // refinement
                let old_dist = dist;
                let new_pos = pos + d * dist;
                T = new_pos - center;
                A = 1.0;
                B = 2.0 * T.dot(d);
                C = T.dot(T) - radius * radius;
                delta = B * B - 4 * A * C;
                if (delta > 0) {
                    sdelta = ti.sqrt(delta);
                    ratio = 0.5 / A;
                    ret1 = ratio * (-B - sdelta) + old_dist;
                    if (ret1 > 0) {
                        dist = ret1;
                        hit_pos = new_pos + ratio * (-B - sdelta) * d;
                    }
                } else {
                    dist = inf;
                }
            }
        }
        return dist;
    };

    let intersect_plane = (pos, d, pt_on_plane, norm, dist, hit_pos) => {
        dist = inf;
        hit_pos = [0.0, 0.0, 0.0];
        let denom = d.dot(norm);
        if (abs(denom) > eps) {
            dist = norm.dot(pt_on_plane - pos) / denom;
            hit_pos = pos + d * dist;
        }
    };

    let intersect_aabb = (box_min, box_max, o, d, near_t, far_t, near_norm) => {
        let intersect = 1;

        near_t = -inf;
        far_t = inf;
        near_norm = [0.0, 0.0, 0.0];

        let near_face = 0;
        let near_is_max = 0;

        for (let i of ti.static(range(3))) {
            if (d[i] == 0) {
                if (o[i] < box_min[i] || o[i] > box_max[i]) {
                    intersect = 0;
                }
            } else {
                let i1 = (box_min[i] - o[i]) / d[i];
                let i2 = (box_max[i] - o[i]) / d[i];

                let new_far_t = max(i1, i2);
                let new_near_t = min(i1, i2);
                let new_near_is_max = i2 < i1;

                far_t = min(new_far_t, far_t);
                if (new_near_t > near_t) {
                    near_t = new_near_t;
                    near_face = i32(i);
                    near_is_max = new_near_is_max;
                }
            }
        }
        if (near_t > far_t) {
            intersect = 0;
        }
        if (intersect) {
            for (let i of ti.static(range(3))) {
                if (near_face == i) {
                    near_norm[i] = -1 + near_is_max * 2;
                }
            }
        }
        return intersect;
    };

    let intersect_aabb_transformed = (
        box_min,
        box_max,
        o,
        d,
        near_t,
        near_norm
    ) => {
        // Transform the ray to the box's local space
        let obj_o = mat_mul_point(box_m_inv, o);
        let obj_d = mat_mul_vec(box_m_inv, d);
        let far_t = f32(inf);
        let intersect = intersect_aabb(
            box_min,
            box_max,
            obj_o,
            obj_d,
            near_t,
            far_t,
            near_norm
        );
        if (intersect && 0 < near_t) {
            // Transform the normal in the box's local space to world space
            near_norm = mat_mul_vec(box_m_inv_t, near_norm);
        } else {
            intersect = 0;
        }
        return intersect;
    };

    let intersect_light = (pos, d, tmax, t) => {
        let far_t = f32(inf);
        let near_norm = f32([0, 0, 0]);
        let hit = intersect_aabb(
            light_min_pos,
            light_max_pos,
            pos,
            d,
            t,
            far_t,
            near_norm
        );
        if (hit && 0 < t && t < tmax) {
            hit = 1;
        } else {
            hit = 0;
            t = inf;
        }
        return hit;
    };

    let intersect_scene = (pos, ray_dir, normal, c, mat) => {
        let closest = f32(inf);

        let cur_dist = f32(inf);
        let hit_pos = [0.0, 0.0, 0.0];

        // right near sphere
        cur_dist = intersect_sphere(pos, ray_dir, sp1_center, sp1_radius, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = (hit_pos - sp1_center).normalized();
            c = [1.0, 1.0, 1.0];
            mat = mat_glass;
        }
        // left box
        let pnorm = f32([0, 0, 0]);
        let hit = intersect_aabb_transformed(
            box_min,
            box_max,
            pos,
            ray_dir,
            cur_dist,
            pnorm
        );
        if (hit && 0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = [0.8, 0.5, 0.4];
            mat = mat_specular;
        }
        // left
        pnorm = [1.0, 0.0, 0.0];

        intersect_plane(pos, ray_dir, [-1.1, 0.0, 0.0], pnorm, cur_dist, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = [0.65, 0.05, 0.05];
            mat = mat_lambertian;
        }
        // right
        pnorm = [-1.0, 0.0, 0.0];
        intersect_plane(pos, ray_dir, [1.1, 0.0, 0.0], pnorm, cur_dist, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = [0.12, 0.45, 0.15];
            mat = mat_lambertian;
        }
        // bottom
        let gray = [0.93, 0.93, 0.93];
        pnorm = [0.0, 1.0, 0.0];
        intersect_plane(pos, ray_dir, [0.0, 0.0, 0.0], pnorm, cur_dist, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = gray;
            mat = mat_lambertian;
        }
        // top
        pnorm = [0.0, -1.0, 0.001];
        intersect_plane(pos, ray_dir, [0.0, 2.0, 0.0], pnorm, cur_dist, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = gray;
            mat = mat_lambertian;
        }
        // far
        pnorm = [0.0, 0.0, 1.0];
        intersect_plane(pos, ray_dir, [0.0, 0.0, 0.0], pnorm, cur_dist, hit_pos);
        if (0 < cur_dist && cur_dist < closest) {
            closest = cur_dist;
            normal = pnorm;
            c = gray;
            mat = mat_lambertian;
        }
        let hit_l = intersect_light(pos, ray_dir, closest, cur_dist);
        if (hit_l && 0 < cur_dist && cur_dist < closest) {
            // technically speaking, no need to check the second term
            closest = cur_dist;
            normal = light_normal;
            c = gray;
            mat = mat_light;
        }
        return closest;
    };

    let visible_to_light = (pos, ray_dir) => {
        // eps*ray_dir is easy way to prevent rounding error
        // here is best way to check the float precision) {
        // http://www.pbr-book.org/3ed-2018/Shapes/Managing_Rounding_Error.html

        let normal = f32([0, 0, 0]);
        let c = f32([0, 0, 0]);
        let mat = mat_none;
        intersect_scene(pos + eps * ray_dir, ray_dir, normal, c, mat);
        return mat == mat_light;
    };

    let dot_or_zero = (n, l) => {
        return max(0.0, n.dot(l));
    };

    let mis_power_heuristic = (pf, pg) => {
        // Assume 1 sample for each distribution
        let f = pf ** 2;
        let g = pg ** 2;
        return f / (f + g);
    };

    let compute_area_light_pdf = (pos, ray_dir) => {
        let t = 0.0;
        let hit_l = intersect_light(pos, ray_dir, inf, t);
        let pdf = 0.0;
        if (hit_l) {
            let l_cos = light_normal.dot(-ray_dir);
            if (l_cos > eps) {
                let tmp = ray_dir * t;
                let dist_sqr = tmp.dot(tmp);
                pdf = dist_sqr / (light_area * l_cos);
            }
        }
        return pdf;
    };

    let compute_brdf_pdf = (normal, sample_dir) => {
        return dot_or_zero(normal, sample_dir) / Math.PI;
    };

    let sample_area_light = (hit_pos, pos_normal) => {
        // sampling inside the light area
        let x = ti.random() * light_x_range + light_x_min_pos;
        let z = ti.random() * light_z_range + light_z_min_pos;
        let on_light_pos = [x, light_y_pos, z];
        return (on_light_pos - hit_pos).normalized();
    };

    let sample_brdf = (normal) => {
        // cosine hemisphere sampling
        // Uniformly sample on a disk using concentric sampling(r, theta)
        let r = 0.0;
        let theta = 0.0;
        let sx = ti.random() * 2.0 - 1.0;
        let sy = ti.random() * 2.0 - 1.0;
        if (sx != 0 || sy != 0) {
            if (abs(sx) > abs(sy)) {
                r = sx;
                theta = (Math.PI / 4) * (sy / sx);
            } else {
                r = sy;
                theta = (Math.PI / 4) * (2 - sx / sy);
            }
        }
        // Apply Malley's method to project disk to hemisphere
        let u = [1.0, 0.0, 0.0];
        if (abs(normal[1]) < 1 - eps) {
            u = normal.cross([0.0, 1.0, 0.0]);
        }
        let v = normal.cross(u);
        let costt = ti.cos(theta);
        let sintt = ti.sin(theta);
        let xy = (u * costt + v * sintt) * r;
        let zlen = ti.sqrt(max(0.0, 1.0 - xy.dot(xy)));
        return xy + zlen * normal;
    };

    let sample_direct_light = (hit_pos, hit_normal, hit_color) => {
        let direct_li = [0.0, 0.0, 0.0];
        let fl = lambertian_brdf * hit_color * light_color;
        let light_pdf = 0.0;
        let brdf_pdf = 0.0;

        // sample area light
        let to_light_dir = sample_area_light(hit_pos, hit_normal);
        if (to_light_dir.dot(hit_normal) > 0) {
            light_pdf = compute_area_light_pdf(hit_pos, to_light_dir);
            brdf_pdf = compute_brdf_pdf(hit_normal, to_light_dir);
            if (light_pdf > 0 && brdf_pdf > 0) {
                let l_visible = visible_to_light(hit_pos, to_light_dir);
                if (l_visible) {
                    let w = mis_power_heuristic(light_pdf, brdf_pdf);
                    let nl = dot_or_zero(to_light_dir, hit_normal);
                    direct_li += (fl * w * nl) / light_pdf;
                }
            }
        }

        // sample brdf
        let brdf_dir = sample_brdf(hit_normal);
        brdf_pdf = compute_brdf_pdf(hit_normal, brdf_dir);
        if (brdf_pdf > 0) {
            light_pdf = compute_area_light_pdf(hit_pos, brdf_dir);
            if (light_pdf > 0) {
                let l_visible = visible_to_light(hit_pos, brdf_dir);
                if (l_visible) {
                    let w = mis_power_heuristic(brdf_pdf, light_pdf);
                    let nl = dot_or_zero(brdf_dir, hit_normal);
                    direct_li += (fl * w * nl) / brdf_pdf;
                }
            }
        }
        return direct_li;
    };

    let schlick = (cos, eta) => {
        let r0 = (1.0 - eta) / (1.0 + eta);
        r0 = r0 * r0;
        return r0 + (1 - r0) * (1.0 - cos) ** 5;
    };

    let sample_ray_dir = (indir, normal, hit_pos, mat, pdf) => {
        let u = [0.0, 0.0, 0.0];
        pdf = 1.0;
        if (mat == mat_lambertian) {
            u = sample_brdf(normal);
            pdf = max(eps, compute_brdf_pdf(normal, u));
        } else if (mat == mat_specular) {
            u = reflect(indir, normal);
        } else if (mat == mat_glass) {
            let cos = indir.dot(normal);
            let ni_over_nt = refr_idx;
            let outn = normal;
            if (cos > 0.0) {
                outn = -normal;
                cos = refr_idx * cos;
            } else {
                ni_over_nt = 1.0 / refr_idx;
                cos = -cos;
            }

            let refr_dir = refract(indir, outn, ni_over_nt);
            let has_refr = 1;
            if (refr_dir.norm_sqr() == 0.0) {
                has_refr = 0;
            }
            let refl_prob = 1.0;
            if (has_refr) {
                refl_prob = schlick(cos, refr_idx);
            }

            if (ti.random() < refl_prob) {
                u = reflect(indir, normal);
            } else {
                u = refr_dir;
            }
        }
        return u.normalized();
    };

    ti.addToKernelScope({
        reflect,
        refract,
        mat_mul_point,
        mat_mul_vec,
        intersect_aabb,
        intersect_aabb_transformed,
        intersect_light,
        intersect_plane,
        intersect_sphere,
        intersect_scene,
        visible_to_light,
        dot_or_zero,
        mis_power_heuristic,
        compute_area_light_pdf,
        compute_brdf_pdf,
        sample_area_light,
        sample_brdf,
        sample_direct_light,
        schlick,
        sample_ray_dir,
    });

    let render = ti.kernel(() => {
        for (let UV of ndrange(res[0], res[1])) {
            let u = UV[0];
            let v = UV[1];
            let aspect_ratio = res[0] / res[1];
            let pos = camera_pos;
            let cur_iter = count_var[0];
            let str_x = i32(cur_iter / stratify_res);
            let str_y = cur_iter % stratify_res;
            let ray_dir = [
                (2 * fov * (u + (str_x + ti.random()) * inv_stratify)) / res[1] -
                fov * aspect_ratio -
                1e-5,
                (2 * fov * (v + (str_y + ti.random()) * inv_stratify)) / res[1] -
                fov -
                1e-5,
                -1.0,
            ];
            ray_dir = ray_dir.normalized();

            let acc_color = [0.0, 0.0, 0.0];
            let throughput = [1.0, 1.0, 1.0];

            let depth = 0;
            while (depth < max_ray_depth) {
                let hit_normal = f32([0, 0, 0]);
                let hit_color = f32([0, 0, 0]);
                let mat = mat_none;
                let closest = intersect_scene(pos, ray_dir, hit_normal, hit_color, mat);
                if (mat == mat_none) {
                    break;
                }
                let hit_pos = pos + closest * ray_dir;
                let hit_light = mat == mat_light;
                if (hit_light) {
                    acc_color = acc_color + throughput * light_color;
                    break;
                } else if (mat == mat_lambertian) {
                    acc_color =
                        acc_color +
                        throughput * sample_direct_light(hit_pos, hit_normal, hit_color);
                }
                depth += 1;
                let pdf = 1.0;
                ray_dir = sample_ray_dir(ray_dir, hit_normal, hit_pos, mat, pdf);
                pos = hit_pos + 1e-4 * ray_dir;
                if (mat == mat_lambertian) {
                    throughput =
                        (throughput *
                            lambertian_brdf *
                            hit_color *
                            dot_or_zero(hit_normal, ray_dir)) /
                        pdf;
                } else {
                    throughput = throughput * hit_color;
                }
            }
            color_buffer[[u, v]] = color_buffer[[u, v]] + acc_color;
        }
        count_var[0] = (count_var[0] + 1) % (stratify_res * stratify_res);
    });

    let tonemap = ti.kernel((accumulated) => {
        for (let I of ndrange(res[0], res[1])) {
            tonemapped_buffer[I] =
                (ti.sqrt((color_buffer[I] / accumulated) * 100.0), 1.0);
        }
    });

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 500;
    htmlCanvas.height = 500;
    let canvas = new ti.Canvas(htmlCanvas);

    let interval = 10;
    let last_t = new Date().getTime();
    let total_samples = 0;
    async function frame() {
        if (window.shouldStop) {
            return;
        }
        for (let i = 0; i < interval; ++i) {
            render();
            total_samples += 1;
        }
        tonemap(total_samples);
        await ti.sync(); // otherwise the time measurement is weird
        let curr_t = new Date().getTime();
        let duration_seconds = (curr_t - last_t) / 1000.0;
        let samplesPerSecond = interval / duration_seconds;
        console.log(samplesPerSecond, ' samples/s');
        last_t = curr_t;
        canvas.setImage(tonemapped_buffer);
        requestAnimationFrame(frame);
    }
    await frame();
};
main()