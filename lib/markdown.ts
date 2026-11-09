import {Lexer,type Token,type Tokens} from 'marked';
import type {Block,Page} from './workspace';

export function parseMarkdown(source:string,options:{title?:string;filename?:string;extractTitle?:boolean}={}){
 if(source.length>500_000)throw Error('Markdown troppo grande: massimo 500.000 caratteri.');
 const tokens=Lexer.lex(source.replace(/^\uFEFF/,''),{gfm:true});
 const first=tokens.find(token=>token.type!=='space');
 const heading=first?.type==='heading'&&first.depth===1?first as Tokens.Heading:undefined;
 const headingTitle=heading?.text.replace(/[*_`]/g,'').trim();
 const title=options.title?.trim()||headingTitle||options.filename?.replace(/\.md$/i,'')||'Pagina importata';
 const blocks:Block[]=[],warnings=new Set<string>();
 const add=(type:string,text:string,extra:Partial<Block>={})=>{
  if(text.length>50000)throw Error('Un blocco supera il limite di 50.000 caratteri.');
  if(blocks.length>=1000)throw Error('Il documento supera il limite di 1.000 blocchi importabili.');
  blocks.push({id:globalThis.crypto.randomUUID(),type,text,...extra});
 };
 function list(token:Tokens.List,indent:number){
  token.items.forEach((item,index)=>{
   let firstParagraph=true;
   for(const child of item.tokens){
    if(child.type==='space'||child.type==='checkbox')continue;
    if(child.type==='list'){list(child as Tokens.List,indent+1);continue;}
    if((child.type==='text'||child.type==='paragraph')&&firstParagraph){
     let text=String(child.text);
     // In loose lists marked keeps the checkbox in paragraph.text as well as
     // emitting an inline checkbox token. Tight lists already remove it.
     const checkbox=(child as Tokens.Paragraph).tokens?.[0];
     if(item.task&&checkbox?.type==='checkbox'&&text.startsWith(checkbox.raw))text=text.slice(checkbox.raw.length);
     add(item.task?'todo':token.ordered?'numbered':'bullet',text,{indent:Math.min(indent,12),...(item.task?{checked:!!item.checked}:{}),...(token.ordered?{number:Number(token.start||1)+index}:{})});firstParagraph=false;
    }else walk(child,indent+1);
   }
   if(firstParagraph)add(item.task?'todo':token.ordered?'numbered':'bullet','',{indent:Math.min(indent,12),...(item.task?{checked:!!item.checked}:{}),...(token.ordered?{number:Number(token.start||1)+index}:{})});
  });
 }
 function walk(token:Token,indent=0){
  const nesting=indent?{indent:Math.min(indent,12)}:{};
  switch(token.type){
   case 'space':return;
   case 'heading':add('h'+token.depth,String(token.text),nesting);return;
   case 'paragraph':case 'text':add('text',String(token.text),nesting);return;
   case 'list':list(token as Tokens.List,indent);return;
   case 'blockquote':{
    const text=String(token.text),note=text.match(/^\[!NOTE\]\s*\n([\s\S]*)$/i);
    add(note?'callout':'quote',note?note[1]:text,nesting);return;
   }
   case 'code':add('code',String(token.text),{...nesting,...(token.lang?{language:String(token.lang).replace(/[\r\n`~]/g,'').slice(0,80)}:{})});return;
   case 'hr':add('divider','',nesting);return;
   case 'table':warnings.add('Le tabelle sono conservate come blocchi di codice Markdown.');add('code',token.raw.trim(),{...nesting,language:'markdown'});return;
   case 'html':warnings.add('HTML conservato come testo, senza eseguirlo.');add('text',token.raw.trim(),nesting);return;
   default:add('text',token.raw.trim(),nesting);
  }
 }
 for(const token of tokens){if(options.extractTitle!==false&&token===heading&&(!options.title||options.title.trim()===headingTitle))continue;walk(token);}
 return {title:title.slice(0,300),blocks,warnings:[...warnings]};
}

export function blocksToMarkdown(blocks:Block[]){
 return blocks.map(block=>{
  const indentation='  '.repeat(block.indent||0),text=block.text;
  if(block.type==='code'){
   const longest=Math.max(0,...Array.from(text.matchAll(/`+/g),match=>match[0].length));
   const fence='`'.repeat(Math.max(3,longest+1));return indentation+fence+(block.language||'')+'\n'+text.split('\n').map(line=>indentation+line).join('\n')+'\n'+indentation+fence;
  }
  if(block.type==='divider')return indentation+'---';
  if(/^h[1-6]$/.test(block.type))return indentation+'#'.repeat(Number(block.type.slice(1)))+' '+text;
  if(block.type==='quote'||block.type==='callout')return (block.type==='callout'?indentation+'> [!NOTE]\n':'')+text.split('\n').map(line=>indentation+'> '+line).join('\n');
  const prefix=block.type==='todo'?`- [${block.checked?'x':' '}] `:block.type==='bullet'?'- ':block.type==='numbered'?`${block.number||1}. `:'';
  return indentation+prefix+text.replace(/\n/g,'\n'+indentation+(prefix?' '.repeat(prefix.length):''));
 }).join('\n\n');
}
export function pageToMarkdown(page:Page){return '# '+page.title+'\n\n'+blocksToMarkdown(page.blocks);}
