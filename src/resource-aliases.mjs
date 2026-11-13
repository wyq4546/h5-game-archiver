// Unity/Laya exports can retain an editor's trailing space before .lh.
// Alias only a recorded failed declaration to an actually saved sibling file.
export function declaredWhitespaceAliases(resources){
 const records=new Map(resources.map(r=>[r.url,r])),aliases=new Map();
 for(const r of resources){if(!r.saved||!r.path||r.status<200||r.status>=300)continue;const u=new URL(r.url);if(!/%20\.lh$/i.test(u.pathname))continue;const canonical=new URL(u);canonical.pathname=canonical.pathname.replace(/(?:%20)+(?=\.lh$)/i,'');const declaration=records.get(canonical.href);if(!declaration||declaration.saved||declaration.status!==404)continue;if(aliases.has(canonical.href)&&aliases.get(canonical.href)!==r.url){aliases.delete(canonical.href);continue;}aliases.set(canonical.href,r.url);}
 return aliases;
}
export function declaredResourceAliases(manifest){
 const aliases=declaredWhitespaceAliases(manifest.resources),records=new Map(manifest.resources.map(r=>[r.url,r]));
 for(const a of manifest.offlineResourceAliases||[]){const from=records.get(a.from),to=records.get(a.to);if(!a.userApproved||!a.reason||!from||(from.saved&&from.status>=200&&from.status<300)||![404,500].includes(from.status)||!to?.saved||!to.path||to.status<200||to.status>=300)continue;const u=new URL(a.from),v=new URL(a.to);if(u.origin!==v.origin||!(u.pathname.endsWith('.lh')&&v.pathname.endsWith('.lh')||u.pathname.endsWith('.png')&&v.pathname.endsWith('.png')))continue;aliases.set(a.from,a.to);}
 return aliases;
}
