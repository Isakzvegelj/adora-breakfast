
(() => {
 const form=document.querySelector('#breakfast-form'),isSl=document.documentElement.lang==='sl';
 const date=form.elements.date,guests=form.elements.guests;
 const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');date.min=today;
 const total=()=>{const n=Number(guests.value);document.querySelector('#party-total').textContent=isSl?`Skupaj za zajtrk: ${n*35} € · ${guests.options[guests.selectedIndex].text}`:`Breakfast total: €${n*35} · ${guests.options[guests.selectedIndex].text}`;};guests.addEventListener('change',total);total();
 const details=document.querySelector('#request-details'),fallback=document.querySelector('.request-fallback'),status=document.querySelector('#form-status'),copy=document.querySelector('#copy-request');
 if(isSl){copy.textContent='Kopirajte povpraševanje';fallback.querySelector('label').childNodes[0].nodeValue='Podatki povpraševanja';fallback.querySelector('a').textContent='Odprite e-pošto';fallback.querySelector('p').textContent='Če se e-poštna aplikacija ne odpre, kopirajte podatke v e-pošto na info@adorabreakfast.com ali nas pokličite.';document.querySelector('.contact a[href^="mailto:"]').textContent='E-pošta: info@adorabreakfast.com';document.querySelector('.contact a[href^="tel:"]').textContent='Pokličite: +386 51 603 858';}
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const labels=isSl?['Ime','Datum','Gostje','Želeno mesto','Opombe']:['Name','Date','Guests','Preferred seating','Notes'];
  const values=[form.elements.name.value,date.value,guests.options[guests.selectedIndex].text,form.elements.seating.value,form.elements.notes.value];
  details.value=labels.map((x,i)=>x+': '+values[i]).join('\n')+'\n'+document.querySelector('#party-total').textContent;
  const url='mailto:info@adorabreakfast.com?subject='+encodeURIComponent((isSl?'Povpraševanje za zajtrk — ':'Breakfast table request — ')+date.value)+'&body='+encodeURIComponent(details.value);
  fallback.hidden=false;fallback.querySelector('a').href=url;
  status.textContent=isSl?'Osnutek je pripravljen. Pošljite e-pošto; rezervacija še ni potrjena.':'Draft prepared. Please send the email; your table is not confirmed yet.';
  window.location.href=url;
 });
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(details.value);status.textContent=isSl?'Podatki so kopirani. Prilepite jih v e-pošto in jo pošljite.':'Request copied. Paste it into your email and send it.';}catch{details.focus();details.select();status.textContent=isSl?'Označite in kopirajte podatke ter jih pošljite po e-pošti.':'Select and copy these details, then send them by email.';}});
})();
