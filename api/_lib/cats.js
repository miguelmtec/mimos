// Cat rows -> API shapes, shared by /api/me and /api/cats.
const iso = (d) => new Date(d).toISOString();

export const catJson = (r) => ({
  id: r.id, name: r.name, breed: r.breed, spec: r.spec, bio: r.bio, instagram: r.instagram,
  isPublic: r.is_public, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

// Gallery shape: no owner id, no email, nothing that links a cat to a person.
export const publicCatJson = (r) => ({
  id: r.id, name: r.name, breed: r.breed, spec: r.spec, bio: r.bio, instagram: r.instagram,
  createdAt: iso(r.created_at),
});

export async function listCats(sql, userId) {
  const rows = await sql`select id, name, breed, spec, bio, instagram, is_public, created_at, updated_at
    from vp_cats where user_id = ${userId} order by created_at asc, id asc`;
  return rows.map(catJson);
}
