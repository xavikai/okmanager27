"""Genera els models GLB dels jugadors d'hoquei patins (OK Manager 27).

Coordenades: es dissenya en les unitats i eixos del joc (three.js: x endavant, y amunt, z costat)
i es converteixen a Blender (x, -z, y) perquè l'exportador glTF (Y amunt) les retorni igual.
Proporcions idèntiques a l'esquelet procedimental del joc, perquè la cinemàtica inversa coincideixi.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/home/claude/models/out'
os.makedirs(OUT, exist_ok=True)


def B(x, y, z):
    """Coordenades del joc -> Blender."""
    return Vector((x, -z, y))


def G(v):
    """Blender -> coordenades del joc."""
    return (v.x, v.z, -v.y)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m


# ---------------------------------------------------------------------------
# Esquelet
# ---------------------------------------------------------------------------
def build_armature(spec):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = spec['name'] + 'Rig'
    arm.data.name = spec['name'] + 'Armature'
    eb = arm.data.edit_bones
    for b in list(eb):
        eb.remove(b)
    bones = {}
    for name, head, tail, parent in spec['bones']:
        b = eb.new(name)
        b.head = B(*head)
        b.tail = B(*tail)
        b.roll = 0
        if parent:
            b.parent = bones[parent]
        bones[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def skater_bones(H=1.80, hipX=0.04, upper=(0.06, 1.09, 0.55), arm=(0.64, 0.66), leg=(0.78, 0.79), hipZ=0.29,
                 neck=1.31, headC=1.64, spread=15):
    U = H + 0.03  # origen del tronc (pelvis + 0,03)
    sx, sy, sz = upper
    shoulderY = U + sy
    a = math.radians(spread)
    bones = [
        ('Hips', (hipX, H, 0), (hipX, H + 0.2, 0), None),
        ('Spine', (hipX, U, 0), (hipX, U + 0.62, 0), 'Hips'),
        ('Chest', (hipX, U + 0.62, 0), (hipX, U + neck, 0), 'Spine'),
        ('Neck', (hipX, U + neck, 0), (hipX, U + neck + 0.18, 0), 'Chest'),
        ('Head', (hipX, U + neck + 0.18, 0), (hipX, U + headC + 0.38, 0), 'Neck'),
    ]
    for side, s in (('L', -1), ('R', 1)):
        sh = (hipX + sx, shoulderY, s * sz)
        d = (0, -math.cos(a), s * math.sin(a))
        el = (sh[0], sh[1] + d[1] * arm[0], sh[2] + d[2] * arm[0])
        wr = (el[0], el[1] + d[1] * arm[1], el[2] + d[2] * arm[1])
        hd = (wr[0], wr[1] + d[1] * 0.18, wr[2] + d[2] * 0.18)
        bones += [
            ('Shoulder.' + side, (hipX + 0.02, shoulderY + 0.08, s * 0.12), sh, 'Chest'),
            ('UpperArm.' + side, sh, el, 'Shoulder.' + side),
            ('ForeArm.' + side, el, wr, 'UpperArm.' + side),
            ('Hand.' + side, wr, hd, 'ForeArm.' + side),
        ]
        hj = (hipX, H, s * hipZ)
        kn = (hipX, H - leg[0], s * hipZ)
        an = (hipX, H - leg[0] - leg[1], s * hipZ)
        bones += [
            ('Thigh.' + side, hj, kn, 'Hips'),
            ('Shin.' + side, kn, an, 'Thigh.' + side),
            ('Foot.' + side, an, (an[0] + 0.3, max(0.02, an[1] - 0.12), an[2]), 'Shin.' + side),
        ]
    return bones


# ---------------------------------------------------------------------------
# Cos orgànic: modificador Skin sobre un graf de punts, subdivisió i retoc anatòmic
# ---------------------------------------------------------------------------
def skin_body(name, points, edges):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    verts = {}
    for key, (pos, r) in points.items():
        verts[key] = bm.verts.new(B(*pos))
    for a, b in edges:
        bm.edges.new((verts[a], verts[b]))
    bm.to_mesh(me)
    bm.free()
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    mod = ob.modifiers.new('Skin', 'SKIN')
    mod.branch_smoothing = 0.6
    mod.use_smooth_shade = True
    keys = list(points.keys())
    for i, key in enumerate(keys):
        r = points[key][1]
        rx, ry = (r, r) if not isinstance(r, tuple) else r
        me.skin_vertices[0].data[i].radius = (rx, ry)
    me.skin_vertices[0].data[keys.index(points_root(points))].use_root = True
    sub = ob.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    bpy.ops.object.modifier_apply(modifier='Skin')
    bpy.ops.object.modifier_apply(modifier='Sub')
    return ob


def points_root(points):
    return 'hip' if 'hip' in points else list(points.keys())[0]


def shape_torso(ob, H, hipX, chest_widen=1.16, depth=0.8, top=3.2, arm_limit=0.42):
    me = ob.data
    for v in me.vertices:
        x, y, z = G(v.co)
        if H - 0.25 < y < top and abs(z) < arm_limit + 0.05:
            # Pit i esquena: més ample que profund, espatlles marcades.
            k = min(1.0, max(0.0, (y - (H - 0.25)) / 0.6))
            nx = hipX + (x - hipX) * (1 - (1 - depth) * k)
            nz = z * (1 + (chest_widen - 1) * k * min(1.0, abs(z) / 0.2))
            if y > H + 0.75 and x > hipX:
                nx += 0.025 * math.sin(min(1, (y - H - 0.75) / 0.45) * math.pi)
            if H - 0.25 < y < H + 0.15 and x < hipX:
                nx -= 0.03  # glutis
            v.co = B(nx, y, nz)


def nearest_bone_region(point, segs):
    best, bestd = None, 1e9
    p = Vector(point)
    for name, a, b in segs:
        a, b = Vector(a), Vector(b)
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.dot(ab))))
        d = (a + ab * t - p).length
        if d < bestd:
            best, bestd = name, d
    return best


def assign_regions(ob, bones, rules):
    """Assigna materials per cara segons l'os més proper i l'alçada."""
    segs = [(n, h, t) for n, h, t, _ in bones if not n.startswith('Foot') and not n.startswith('Hand') and n != 'Head']
    me = ob.data
    slots = {}
    for f in me.polygons:
        c = G(f.center)
        region = nearest_bone_region(c, segs)
        mat = rules(region, c)
        if mat not in slots:
            ob.data.materials.append(bpy.data.materials[mat])
            slots[mat] = len(ob.data.materials) - 1
        f.material_index = slots[mat]


def cylinder_uv(ob, matname, hipX, y0, y1):
    """UV cilíndrica per a la samarreta: davant a u=0,25, esquena a u=0,75, v=1 al coll."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    idx = [i for i, m in enumerate(me.materials) if m and m.name == matname]
    for f in me.polygons:
        if f.material_index not in idx:
            continue
        us = []
        for li in f.loop_indices:
            x, y, z = G(me.vertices[me.loops[li].vertex_index].co)
            th = math.atan2(z, x - hipX)
            u = (0.25 - th / (2 * math.pi)) % 1.0
            us.append((li, u, (y - y0) / (y1 - y0)))
        # Evita que una cara travessi la costura u=0/1.
        vals = [u for _, u, _ in us]
        if max(vals) - min(vals) > 0.5:
            us = [(li, u + 1 if u < 0.5 else u, v) for li, u, v in us]
        for li, u, v in us:
            uv[li].uv = (u, v)


# ---------------------------------------------------------------------------
# Cap: esfera modelada (mandíbula, nas, celles, conques), orelles i cabell
# ---------------------------------------------------------------------------
def head_shape(r, th, ph):
    """Radi del cap en funció de l'angle horitzontal (th, 0 = davant) i l'elevació (ph)."""
    g = lambda a, s: math.exp(-(a / s) ** 2)
    rad = r
    # Ou: més alt que ample, cara una mica plana, mandíbula estreta.
    front = max(0.0, math.cos(th))
    rad *= 1 - 0.05 * front * g(ph - 0.05, 0.5)
    if ph < -0.15:
        rad *= 1 - 0.13 * min(1, (-0.15 - ph) / 0.9) * (1 - 0.6 * front)
    rad += r * 0.05 * g(abs(th) - math.pi, 0.9) * g(ph - 0.15, 0.6)            # occipital
    rad += r * 0.16 * g(th, 0.085) * g(ph + 0.07, 0.13) * (0.6 + 0.4 * g(ph + 0.16, 0.08))  # nas
    rad += r * 0.035 * g(th, 0.4) * g(ph - 0.2, 0.06)                             # celles
    for s in (-1, 1):
        rad -= r * 0.04 * g(th - s * 0.34, 0.11) * g(ph - 0.07, 0.08)             # conques dels ulls
        rad += r * 0.03 * g(th - s * 0.58, 0.18) * g(ph + 0.06, 0.12)             # pòmuls
    rad += r * 0.02 * g(th, 0.16) * g(ph + 0.36, 0.05)                            # llavis
    rad += r * 0.05 * g(th, 0.22) * g(ph + 0.66, 0.14)                            # barbeta
    return rad


def sphere_from(fn, cx, cy, segs=48, rings=32, sx=1.0, sy=1.16, sz=0.88, name='Head'):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1)
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y
        th = math.atan2(z, x)
        ph = math.asin(max(-1, min(1, y)))
        rad = fn(th, ph)
        v.co = B(cx + x * rad * sx, cy + y * rad * sy, z * rad * sz)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def build_head(cx, cy, r, hairstyle=0):
    ob = sphere_from(lambda th, ph: head_shape(r, th, ph), cx, cy)
    me = ob.data
    me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for f in me.polygons:
        us = []
        for li in f.loop_indices:
            x, y, z = G(me.vertices[me.loops[li].vertex_index].co)
            th = math.atan2(z, x - cx)
            us.append((li, (0.25 - th / (2 * math.pi)) % 1.0, (y - (cy - r * 1.2)) / (r * 2.4)))
        vals = [u for _, u, _ in us]
        if max(vals) - min(vals) > 0.5:
            us = [(li, u + 1 if u < 0.5 else u, v) for li, u, v in us]
        for li, u, v in us:
            uv[li].uv = (u, v)
    ob.data.materials.append(bpy.data.materials['Face'])
    parts = [ob]
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=1,
                                             location=B(cx - 0.02 * r / 0.25, cy - 0.02, s * r * 0.86))
        e = bpy.context.object
        e.scale = (0.045 * r / 0.25, 0.022, 0.07 * r / 0.25)
        e.rotation_euler = (0, -0.15, 0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        e.data.materials.append(bpy.data.materials['Skin'])
        for p in e.data.polygons:
            p.use_smooth = True
        parts.append(e)

    # Cabell: mateixa esfera una mica inflada on hi ha cabell i enfonsada on no (línia de cabell suau).
    def hairline(th):
        a = abs(th)
        if a < 0.7:
            return 0.30 + (0.04 if hairstyle == 1 else 0) - 0.08 * (a / 0.7) ** 2
        if a < 1.75:
            return 0.22 - 0.42 * ((a - 0.7) / 1.05)
        return -0.2 - 0.25 * ((a - 1.75) / (math.pi - 1.75))

    def hair_r(th, ph):
        base = head_shape(r, th, ph)
        d = ph - hairline(th)
        k = max(0.0, min(1.0, d / 0.05 + 0.5))
        k = k * k * (3 - 2 * k)
        thick = (0.055 + 0.03 * max(0, ph)) * r * (1.25 if hairstyle == 2 else 1.0)
        return base + thick * k - 0.12 * r * (1 - k)
    hair = sphere_from(hair_r, cx - 0.005, cy + 0.005, segs=56, rings=40, name='Hair')
    hair.data.materials.append(bpy.data.materials['Hair'])
    parts.append(hair)
    return parts


def rounded_box(name, size, loc, mat, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = ob.modifiers.new('Bevel', 'BEVEL')
    m.width = bevel
    m.segments = 3
    bpy.ops.object.modifier_apply(modifier='Bevel')
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.append(bpy.data.materials[mat])
    return ob


def rigid(ob, group):
    vg = ob.vertex_groups.new(name=group)
    vg.add([v.index for v in ob.data.vertices], 1.0, 'REPLACE')


def bind(body, extras, arm):
    """Pesos automàtics per al cos i peces rígides per a la resta; tot en una malla."""
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bpy.ops.object.select_all(action='DESELECT')
    for ob, _ in extras:
        ob.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    return body


def export(arm, body, path):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    body.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_skins=True, export_animations=False, export_apply=False,
                              export_materials='EXPORT', export_normals=True, export_texcoords=True)


# ---------------------------------------------------------------------------
# JUGADOR (i àrbitre)
# ---------------------------------------------------------------------------
def make_materials():
    material('Jersey', (0.1, 0.25, 0.7), 0.82)
    material('Sleeve', (0.1, 0.25, 0.7), 0.82)
    material('Shorts', (0.05, 0.06, 0.1), 0.75)
    material('Socks', (0.1, 0.2, 0.5), 0.85)
    material('Skin', (0.85, 0.65, 0.5), 0.6)
    material('Face', (0.85, 0.65, 0.5), 0.6)
    material('Hair', (0.12, 0.08, 0.05), 0.9)
    material('Glove', (0.06, 0.07, 0.09), 0.6)
    material('Pad', (0.85, 0.86, 0.88), 0.5)
    material('Protector', (0.9, 0.9, 0.85), 0.55)


def build_skater():
    reset()
    make_materials()
    H, hipX = 1.80, 0.04
    bones = skater_bones(H=H, hipX=hipX)
    arm = build_armature({'name': 'Skater', 'bones': bones})
    U = H + 0.03
    bd = {n: (h, t) for n, h, t, _ in bones}
    pts = {
        'hip': ((hipX, H - 0.02, 0), (0.33, 0.33)),
        'waist': ((hipX, U + 0.32, 0), (0.29, 0.29)),
        'chest': ((hipX, U + 0.78, 0), (0.33, 0.33)),
        'uchest': ((hipX, U + 1.06, 0), (0.31, 0.31)),
        'neck0': ((hipX, U + 1.28, 0), (0.15, 0.15)),
        'neck1': ((hipX, U + 1.6, 0), (0.1, 0.1)),
    }
    edges = [('hip', 'waist'), ('waist', 'chest'), ('chest', 'uchest'), ('uchest', 'neck0'), ('neck0', 'neck1')]
    for s, side in ((-1, 'L'), (1, 'R')):
        sh, el = bd['UpperArm.' + side]
        _, wr = bd['ForeArm.' + side]
        pts['sh' + side] = ((sh[0], sh[1] - 0.02, sh[2] * 0.86), (0.165, 0.165))
        pts['bi' + side] = (tuple((Vector(sh) * 0.55 + Vector(el) * 0.45)), (0.13, 0.13))
        pts['el' + side] = (el, (0.1, 0.1))
        pts['fa' + side] = (tuple((Vector(el) * 0.6 + Vector(wr) * 0.4)), (0.105, 0.105))
        pts['wr' + side] = (wr, (0.075, 0.075))
        edges += [('uchest', 'sh' + side), ('sh' + side, 'bi' + side), ('bi' + side, 'el' + side),
                  ('el' + side, 'fa' + side), ('fa' + side, 'wr' + side)]
        hj, kn = bd['Thigh.' + side]
        _, an = bd['Shin.' + side]
        pts['hj' + side] = ((hj[0], hj[1] - 0.08, hj[2] * 0.75), (0.22, 0.22))
        pts['th' + side] = (tuple(Vector(hj) * 0.55 + Vector(kn) * 0.45), (0.2, 0.2))
        pts['kn' + side] = (kn, (0.135, 0.135))
        pts['ca' + side] = (tuple(Vector(kn) * 0.55 + Vector(an) * 0.45 + Vector((-0.03, 0, 0))), (0.135, 0.135))
        pts['an' + side] = ((an[0], an[1] + 0.06, an[2]), (0.08, 0.08))
        edges += [('hip', 'hj' + side), ('hj' + side, 'th' + side), ('th' + side, 'kn' + side),
                  ('kn' + side, 'ca' + side), ('ca' + side, 'an' + side)]
    body = skin_body('Body', pts, edges)
    shape_torso(body, H, hipX)

    def rules(region, c):
        x, y, z = c
        if region in ('Spine', 'Chest'):
            return 'Jersey' if y > U + 0.28 else 'Shorts'
        if region == 'Hips':
            return 'Shorts'
        if region.startswith('Thigh'):
            return 'Shorts' if y > H - 0.48 else 'Socks'
        if region.startswith('Shin'):
            return 'Socks'
        if region.startswith('UpperArm') or region.startswith('ForeArm') or region.startswith('Shoulder'):
            return 'Sleeve'
        if region == 'Neck':
            return 'Jersey' if y < U + 1.3 else 'Skin'
        return 'Skin'
    assign_regions(body, bones, rules)
    cylinder_uv(body, 'Jersey', hipX, U + 0.25, U + 1.32)

    extras = []
    head_parts = build_head(hipX + 0.01, U + 1.64, 0.25)
    for p in head_parts:
        rigid(p, 'Head')
        extras.append((p, 'Head'))
    for s, side in ((-1, 'L'), (1, 'R')):
        wr, hd = bd['Hand.' + side]
        d = (Vector(hd) - Vector(wr)).normalized()
        c = Vector(wr) + d * 0.1
        g = rounded_box('Glove' + side, (0.2, 0.17, 0.24), B(*c), 'Glove', 0.06)
        rigid(g, 'Hand.' + side)
        extras.append((g, 'Hand.' + side))
        cuff = rounded_box('Cuff' + side, (0.2, 0.2, 0.12), B(wr[0], wr[1] + 0.02, wr[2]), 'Glove', 0.05)
        rigid(cuff, 'ForeArm.' + side)
        extras.append((cuff, 'ForeArm.' + side))
        kn, _ = bd['Shin.' + side]
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=1, location=B(kn[0] + 0.07, kn[1] - 0.02, kn[2]))
        pad = bpy.context.object
        pad.name = 'KneePad' + side
        pad.scale = (0.11, 0.145, 0.17)
        bpy.ops.object.transform_apply(scale=True)
        for p in pad.data.polygons:
            p.use_smooth = True
        pad.data.materials.append(bpy.data.materials['Pad'])
        rigid(pad, 'Shin.' + side)
        extras.append((pad, 'Shin.' + side))
    bind(body, extras, arm)
    body.name = 'SkaterBody'
    export(arm, body, os.path.join(OUT, 'skater.glb'))
    print('skater tris', sum(len(p.vertices) - 2 for p in body.data.polygons))


# ---------------------------------------------------------------------------
# PORTER (el casc, les guardes, els guants i l'estic són del joc)
# ---------------------------------------------------------------------------
def build_goalkeeper():
    reset()
    make_materials()
    H, hipX = 1.55, 0.0
    bones = skater_bones(H=H, hipX=hipX, upper=(0.08, 0.90, 0.60), arm=(0.67, 0.69), leg=(0.67, 0.70), hipZ=0.30,
                         neck=1.12, headC=1.42, spread=20)
    arm = build_armature({'name': 'Goalkeeper', 'bones': bones})
    U = H + 0.02
    bd = {n: (h, t) for n, h, t, _ in bones}
    pts = {
        'hip': ((hipX, H - 0.02, 0), (0.37, 0.37)),
        'waist': ((hipX, U + 0.3, 0), (0.36, 0.36)),
        'chest': ((hipX, U + 0.62, 0), (0.43, 0.43)),
        'uchest': ((hipX, U + 0.88, 0), (0.4, 0.4)),
        'neck0': ((hipX, U + 1.1, 0), (0.17, 0.17)),
        'neck1': ((hipX, U + 1.24, 0), (0.15, 0.15)),
    }
    edges = [('hip', 'waist'), ('waist', 'chest'), ('chest', 'uchest'), ('uchest', 'neck0'), ('neck0', 'neck1')]
    for s, side in ((-1, 'L'), (1, 'R')):
        sh, el = bd['UpperArm.' + side]
        _, wr = bd['ForeArm.' + side]
        pts['sh' + side] = ((sh[0], sh[1], sh[2] * 0.85), (0.21, 0.21))
        pts['bi' + side] = (tuple(Vector(sh) * 0.5 + Vector(el) * 0.5), (0.16, 0.16))
        pts['el' + side] = (el, (0.135, 0.135))
        pts['fa' + side] = (tuple(Vector(el) * 0.5 + Vector(wr) * 0.5), (0.13, 0.13))
        pts['wr' + side] = (wr, (0.09, 0.09))
        edges += [('uchest', 'sh' + side), ('sh' + side, 'bi' + side), ('bi' + side, 'el' + side),
                  ('el' + side, 'fa' + side), ('fa' + side, 'wr' + side)]
        hj, kn = bd['Thigh.' + side]
        _, an = bd['Shin.' + side]
        pts['hj' + side] = ((hj[0], hj[1] - 0.06, hj[2] * 0.8), (0.25, 0.25))
        pts['th' + side] = (tuple(Vector(hj) * 0.5 + Vector(kn) * 0.5), (0.23, 0.23))
        pts['kn' + side] = (kn, (0.16, 0.16))
        pts['an' + side] = ((an[0], an[1] + 0.06, an[2]), (0.1, 0.1))
        edges += [('hip', 'hj' + side), ('hj' + side, 'th' + side), ('th' + side, 'kn' + side), ('kn' + side, 'an' + side)]
    body = skin_body('Body', pts, edges)
    shape_torso(body, H, hipX, chest_widen=1.12, depth=0.85, top=2.7, arm_limit=0.5)

    def rules(region, c):
        x, y, z = c
        if region in ('Spine', 'Chest'):
            return 'Jersey' if y > U + 0.25 else 'Shorts'
        if region == 'Hips' or region.startswith('Thigh'):
            return 'Shorts'
        if region.startswith('Shin'):
            return 'Socks'
        if region.startswith('UpperArm') or region.startswith('ForeArm') or region.startswith('Shoulder'):
            return 'Sleeve'
        return 'Jersey'
    assign_regions(body, bones, rules)
    cylinder_uv(body, 'Jersey', hipX, U + 0.2, U + 1.15)
    # Protector de pit visible a sota del jersei (espatlleres).
    extras = []
    for s, side in ((-1, 'L'), (1, 'R')):
        sh, _ = bd['UpperArm.' + side]
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=B(sh[0] + 0.02, sh[1] + 0.06, sh[2] * 0.92))
        cap = bpy.context.object
        cap.scale = (0.24, 0.22, 0.17)
        bpy.ops.object.transform_apply(scale=True)
        for p in cap.data.polygons:
            p.use_smooth = True
        cap.data.materials.append(bpy.data.materials['Sleeve'])
        rigid(cap, 'Shoulder.' + side)
        extras.append((cap, 'Shoulder.' + side))
    bind(body, extras, arm)
    body.name = 'GoalkeeperBody'
    export(arm, body, os.path.join(OUT, 'goalkeeper.glb'))
    print('goalkeeper tris', sum(len(p.vertices) - 2 for p in body.data.polygons))


build_skater()
build_goalkeeper()
