window.MAPS = [
{{- $maps := where .Site.RegularPages "Section" "map" -}}
{{- $sorted := sort $maps "Params.weight" -}}
{{- range $i, $m := $sorted }}
{
  id: "{{ $m.File.ContentBaseName }}",
  title: "{{ $m.Title }}",
  image: "{{ $m.Params.image }}",
  lv_min: {{ if $m.Params.lv_min }}{{ $m.Params.lv_min }}{{ else }}0{{ end }},
  lv_max: {{ if $m.Params.lv_max }}{{ $m.Params.lv_max }}{{ else }}0{{ end }},
  monsters: {{ if $m.Params.monsters }}{{ $m.Params.monsters | jsonify }}{{ else }}[]{{ end }}
}{{ if lt (add $i 1) (len $sorted) }},{{ end }}
{{- end }}
];
