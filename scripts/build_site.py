#!/usr/bin/env python3
"""Build original lab sources into portable static pages; no third-party packages."""
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true', help='Fail if generated assets are stale')
args = parser.parse_args()

HEIGHT = '''<script>
(()=>{if(parent===window)return;let last=0;const report=()=>{const h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==last){last=h;parent.postMessage({type:'lesson-height',height:h},'*');}};new ResizeObserver(report).observe(document.body);window.addEventListener('load',report);report();})();
</script>'''
CSS = '''
:root{color-scheme:dark;--foreground:#e1e8e6;--muted:#20292b;--muted-foreground:#91a29f;--background:#141a1d;--border:#2b3639;--viz-series-1:#87d5bd;--viz-series-2:#e7ad79}
*{box-sizing:border-box}body{margin:0;padding:18px 22px;background:var(--background);color:var(--foreground);font:14px/1.6 'PingFang SC','Microsoft YaHei',sans-serif}h3{font-size:20px}button,input,select{font:inherit}button{cursor:pointer}button,select{border:1px solid var(--border);background:var(--background);border-radius:4px;color:var(--foreground);padding:6px 10px}input[type=range]{width:100%;accent-color:var(--viz-series-1)}.text-small{font-size:12px}.tabular-nums{font-variant-numeric:tabular-nums}.viz-row,.viz-controls{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:10px 0}.form-label{font-size:12px}.form-select{margin-left:5px}.table-responsive{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--border)}hr{border:0;border-top:1px solid var(--border);margin:18px 0}details{border-top:1px solid var(--border);padding:12px 0}summary{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b87326;outline-offset:3px}@media(max-width:580px){body{padding:14px 12px}}
'''
src = ROOT/'src'
gravity = (src/'gravity/gravity.template.html').read_text()
for key, file in [('__DYNAMICS_ENGINE__','gravity/dynamics.js'),('__MODEL_JSON__','model/model.json'),('__TORQUE_HEAT__','workbench/torque_heat.js'),('__ALL_JOINT_SCENE__','workbench/lab_scene.js'),('__GRAVITY_GEOMETRY__','gravity/gravity_geometry.js'),('__COUPLING_VIEW__','gravity/coupling_view.js'),('__GRAVITY_APP__','gravity/gravity.js')]:
    gravity=gravity.replace(key,(src/file).read_text())
license_text=(src/'model/LICENSE').read_text()
gravity='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YAM 重力补偿实验</title><link rel="icon" href="../assets/icon.svg" type="image/svg+xml"><style>'+CSS+'</style></head><body><!-- I2RT model and reduced geometry: '+license_text+' -->'+gravity+HEIGHT+'</body></html>'
wrench=(src/'wrench/wrench.html').read_text().replace('</html>',HEIGHT+'</html>')
workbench=(src/'workbench/lab.template.html').read_text()
for key,file in [('__LAB_CSS__','workbench/lab.css'),('__DYNAMICS_ENGINE__','gravity/dynamics.js'),('__MODEL_JSON__','model/model.json'),('__LAB_MATH__','workbench/lab_math.js'),('__TORQUE_HEAT__','workbench/torque_heat.js'),('__LAB_SCENE__','workbench/lab_scene.js'),('__LAB_APP__','workbench/lab.js')]:
    workbench=workbench.replace(key,(src/file).read_text())
workbench=workbench.replace('<head>','<!-- I2RT model and reduced geometry: '+license_text+' -->\n<head>',1).replace('</body>',HEIGHT+'</body>')
inertia=(src/'inertia/inertia.template.html').read_text()
for key,file in [('__LAB_CSS__','workbench/lab.css'),('__INERTIA_CSS__','inertia/inertia.css'),('__DYNAMICS_ENGINE__','gravity/dynamics.js'),('__MODEL_JSON__','model/model.json'),('__LAB_MATH__','workbench/lab_math.js'),('__LAB_SCENE__','workbench/lab_scene.js'),('__INERTIA_APP__','inertia/inertia.js')]:
    inertia=inertia.replace(key,(src/file).read_text())
inertia=inertia.replace('<head>','<!-- I2RT model and reduced geometry: '+license_text+' -->\n<head>',1).replace('</body>',HEIGHT+'</body>')
outputs={ROOT/'docs/labs/gravity.html':gravity,ROOT/'docs/labs/wrench.html':wrench,ROOT/'docs/labs/workbench.html':workbench,ROOT/'docs/labs/inertia.html':inertia}
course_path=ROOT/'docs/index.html'
course=course_path.read_text()
for lesson,source in [('INERTIA','inertia/lesson.html'),('DYNAMICS','workbench/lesson.html')]:
    start=f'<!-- {lesson}_LESSON_START -->'
    end=f'<!-- {lesson}_LESSON_END -->'
    before,remainder=course.split(start,1)
    _,after=remainder.split(end,1)
    course=before+start+'\n'+(src/source).read_text().strip()+'\n'+end+after
outputs[course_path]=course
for name in ['gravity-1r.svg','gravity-2r.svg','inertia-2r.svg']:
    outputs[ROOT/'docs/assets'/name]=(src/'figures'/name).read_text()
inertia_figure=(src/'figures/inertia-2r.svg').read_text()
for name,box in [('extended','0 80 420 270'),('folded','420 80 420 270')]:
    outputs[ROOT/'docs/assets'/f'inertia-2r-{name}.svg']=inertia_figure.replace('viewBox="0 0 840 350"',f'viewBox="{box}"')
for name,source in [('yam.urdf',src/'model/yam.urdf'),('I2RT-LICENSE',src/'model/LICENSE'),('LICENSE',ROOT/'LICENSE'),('CONTENT-LICENSE.md',ROOT/'CONTENT-LICENSE.md'),('README.md',ROOT/'README.md')]:
    outputs[ROOT/'docs/downloads'/name]=source.read_text()
stale=[]
for target,contents in outputs.items():
    if args.check:
        if not target.exists() or target.read_text()!=contents:stale.append(str(target.relative_to(ROOT)))
    else:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(contents)
if stale:raise SystemExit('Generated files are stale: '+', '.join(stale))
print(('Checked' if args.check else 'Built')+f' {len(outputs)} static assets.')
