{{- /*
  monsters-data.js（window.MONSTERS）を生成する。

  [status] と [fixed_status] はトップレベルに平坦化して出力する。
  値が欠けている場合は 0 / 空配列 を入れる。
  pet_skill_levels は data/pet-skill-patterns.yaml を
  モンスターの pet_skill_pattern で引いた解決済みの配列。
*/ -}}
{{- $stats := slice "vit" "spd" "atk" "int" "def" "mdef" "luk" -}}
{{- $patterns := index site.Data "pet-skill-patterns" -}}
window.MONSTERS = [
{{- $sorted := sort (where .Site.RegularPages "Section" "monster") "Params.id" -}}
{{- range $i, $m := $sorted }}
{
  id: "{{ $m.Params.id }}",
  title: "{{ $m.Params.title }}",
  element: "{{ $m.Params.element }}",
  attack_type: "{{ $m.Params.attack_type }}",
  attack_range: "{{ $m.Params.attack_range }}",
  level_shortcuts: {{ with $m.Params.level_shortcuts }}{{ . | jsonify }}{{ else }}[]{{ end }},
  exp: {{ $m.Params.exp | default 0 }},
  gold: {{ $m.Params.gold | default 0 }},
  capture_rate: {{ $m.Params.capture_rate | default 0 }},
  drops: {{ with $m.Params.drops }}{{ . | jsonify }}{{ else }}[]{{ end }},
  locations: {{ with $m.Params.locations }}{{ . | jsonify }}{{ else }}[]{{ end }},
  pet_skill_levels: {{ with $m.Params.pet_skill_pattern }}{{ with index $patterns . }}{{ . | jsonify }}{{ else }}[]{{ end }}{{ else }}[]{{ end }},
{{- range $k := $stats }}
  {{ $k }}: {{ index ($m.Params.status | default dict) $k | default 0 }},
{{- end }}
  mov: {{ with $m.Params.fixed_status }}{{ .mov | default 0 }}{{ else }}0{{ end }}
}{{ if lt (add $i 1) (len $sorted) }},{{ end }}
{{- end }}
];
