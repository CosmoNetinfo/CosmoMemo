import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMarkdown,pageToMarkdown} from '../lib/markdown';
import {sectionRange,searchPages,pageTree} from '../lib/page-content';
import {initial,type Page} from '../lib/workspace';

test('import Markdown in blocchi con titolo, liste, checkbox annidate, citazioni e codice',()=>{
 const imported=parseMarkdown('# Brief\n\nUn **obiettivo** con [fonte](https://example.com).\n\n## Todo\n\n- [ ] Prima attività\n  - [x] Sottoattività\n- Un punto\n\n3. Terzo\n4. Quarto\n\n> Una citazione\n> su due righe\n\n```ts\nconst text = "```";\n```\n\n---\n\n#### Dettagli\n');
 assert.equal(imported.title,'Brief');
 assert.deepEqual(imported.blocks.map(b=>b.type),['text','h2','todo','todo','bullet','numbered','numbered','quote','code','divider','h4']);
 assert.equal(imported.blocks[2].checked,false);assert.equal(imported.blocks[3].checked,true);assert.equal(imported.blocks[3].indent,1);
 assert.equal(imported.blocks[5].number,3);assert.equal(imported.blocks[8].language,'ts');
 const page:Page={...initial.pages[0],title:imported.title,blocks:imported.blocks};
 const exported=pageToMarkdown(page);assert.match(exported,/````ts/);assert.match(exported,/- \[x\] Sottoattività/);
 const again=parseMarkdown(exported);assert.equal(again.title,'Brief');assert.equal(again.blocks.find(b=>b.type==='code')?.text,'const text = "```";');
 assert.deepEqual(again.blocks.filter(b=>b.type==='numbered').map(b=>b.number),[3,4]);
});
test('Markdown non esegue HTML e conserva le tabelle, con avvisi espliciti',()=>{
 const imported=parseMarkdown('<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |');
 assert.equal(imported.blocks[0].type,'text');assert.match(imported.blocks[0].text,/<script>/);
 assert.equal(imported.blocks[1].language,'markdown');assert.equal(imported.warnings.length,2);
 assert.throws(()=>parseMarkdown('x'.repeat(500001)));
 assert.equal(parseMarkdown('# Rimane titolo',{extractTitle:false}).blocks[0].type,'h1');
});

test('checkbox in liste loose: il marcatore strutturale viene rimosso una sola volta',()=>{
 const source='# Brief\n\n- [ ] Prima attività\n\n- [x] Seconda attività\n\n  Paragrafo aggiuntivo\n\n  - [ ] Sottoattività\n\n- [ ] [x] Testo letterale\n\n- \\[ \\] Testo normale';
 const imported=parseMarkdown(source),todo=imported.blocks.filter(b=>b.type==='todo');
 assert.deepEqual(todo.map(b=>b.text),['Prima attività','Seconda attività','Sottoattività','[x] Testo letterale']);
 assert.deepEqual(todo.map(b=>b.checked),[false,true,false,false]);
 const page={...initial.pages[0],title:imported.title,blocks:imported.blocks};
 const twice=parseMarkdown(pageToMarkdown(page));assert.deepEqual(twice.blocks.filter(b=>b.type==='todo').map(b=>({text:b.text,checked:b.checked})),todo.map(b=>({text:b.text,checked:b.checked})));
 assert.equal(parseMarkdown('- [x] Stretto').blocks[0].text,'Stretto');
 assert.equal(parseMarkdown('- [ ] [x] Intenzionale').blocks[0].text,'[x] Intenzionale');
});

test('ricerca per parole: AND attraverso blocchi e titolo, OR e frase espliciti',()=>{
 const page={...initial.pages[0],title:'Vigilant',blocks:parseMarkdown('Un esempio di curl\n\nVerifica separata',{extractTitle:false}).blocks},workspace={...initial,pages:[page]};
 assert.equal(searchPages(workspace,'vigilant curl').total,1);assert.equal(searchPages(workspace,'vigilant curl',20,0,'phrase').total,0);
 assert.equal(searchPages(workspace,'curl assente').total,0);assert.equal(searchPages(workspace,'curl assente',20,0,'any').total,1);
 assert.equal(searchPages(workspace,'CURL verifica').results[0].matches.length,2);assert.equal(searchPages(workspace,'  VIGILANT   curl  ').total,1);
 assert.equal(searchPages({...workspace,pages:[{...page,deleted:true}]},'curl').total,0);
});
test('sezioni annidate, titoli ripetuti e ricerca testuale con blocco ed estratto',()=>{
 const blocks=parseMarkdown('## Todo\n\n- [ ] Ricordare la possibilità speciale\n\n### Sotto\n\nDettaglio\n\n## Decisioni\n\nScelta definitiva\n\n## Todo\n\nSeconda lista',{extractTitle:false}).blocks;
 const page:Page={...initial.pages[0],title:'Progetto',blocks,revision:4};
 assert.throws(()=>sectionRange(page,{heading:'Todo'}),/ripetuto/);
 const section=sectionRange(page,{heading:'todo',occurrence:1});assert.equal(page.blocks[section.end].text,'Decisioni');
 const second=sectionRange(page,{heading_id:blocks[6].id});assert.equal(second.heading.text,'Todo');
 const workspace={...initial,pages:[page,{...page,id:'trashed',deleted:true}]};
 const found=searchPages(workspace,'possibilita',10);assert.equal(found.total,1);assert.equal(found.results[0].revision,4);assert.equal(found.results[0].matches[0].section?.title,'Todo');assert.equal(found.results[0].matches[0].block_id,blocks[1].id);
 const tree=pageTree([page,{...page,id:'child',parent:page.id}]);assert.equal(tree.total,2);assert.equal(tree.truncated,false);
});
