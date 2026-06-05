# -*- coding: utf-8 -*-
"""Generate Excalidraw ER diagrams for the 50 exercise DOCX.

The output file contains one framed area per exercise, with Chen notation on the
left and crow's foot notation on the right.
"""

from __future__ import annotations

import json
import math
import random
import time
import unicodedata
from pathlib import Path


OUT = Path("50_ejercicios_er_chen_pata_gallo.excalidraw")


def E(name: str, pk: str, *attrs: str) -> dict:
    return {"name": name, "pk": pk, "attrs": list(attrs)}


def R(name: str, a: str, b: str, ca: str, cb: str, attrs: tuple[str, ...] = ()) -> dict:
    return {"name": name, "a": a, "b": b, "ca": ca, "cb": cb, "attrs": list(attrs)}


MODELS = [
    {
        "no": 1,
        "title": "Universidad Básica",
        "entities": [
            E("Estudiante", "código", "nombre", "apellido", "fecha nacimiento"),
            E("Curso", "código", "nombre", "créditos"),
        ],
        "relationships": [
            R("Matrícula", "Estudiante", "Curso", "N", "M", ("fecha matrícula", "calificación final")),
        ],
    },
    {
        "no": 2,
        "title": "Biblioteca Simple",
        "entities": [
            E("Libro", "ISBN", "título", "año publicación", "género"),
            E("Autor", "código", "nombre", "nacionalidad"),
            E("Socio", "DNI", "nombre", "dirección", "teléfono"),
        ],
        "relationships": [
            R("Escribe", "Autor", "Libro", "N", "M"),
            R("Préstamo", "Socio", "Libro", "N", "M", ("fecha préstamo", "fecha devolución")),
        ],
    },
    {
        "no": 3,
        "title": "Hospital Básico",
        "entities": [
            E("Médico", "código", "nombre", "especialidad", "teléfono"),
            E("Paciente", "historia clínica", "nombre", "fecha nacimiento", "dirección"),
            E("Departamento", "código", "nombre", "ubicación"),
        ],
        "relationships": [
            R("Atiende", "Médico", "Paciente", "N", "M", ("fecha consulta", "diagnóstico")),
            R("Pertenece", "Departamento", "Médico", "1", "N"),
        ],
    },
    {
        "no": 4,
        "title": "Tienda de Ropa",
        "entities": [
            E("Producto", "código", "nombre", "precio", "talla", "color"),
            E("Proveedor", "RUC", "nombre", "dirección", "teléfono"),
            E("Categoría", "código", "nombre", "descripción"),
        ],
        "relationships": [
            R("Suministro", "Proveedor", "Producto", "N", "M", ("fecha suministro", "cantidad")),
            R("Clasifica", "Categoría", "Producto", "1", "N"),
        ],
    },
    {
        "no": 5,
        "title": "Club Deportivo",
        "entities": [
            E("Socio", "número socio", "nombre", "fecha inscripción", "tipo membresía"),
            E("Actividad", "código", "nombre", "horario", "lugar"),
            E("Monitor", "código", "nombre", "especialidad"),
        ],
        "relationships": [
            R("Inscripción", "Socio", "Actividad", "N", "M", ("fecha inscripción actividad",)),
            R("Dirige", "Monitor", "Actividad", "1", "N"),
        ],
    },
    {
        "no": 6,
        "title": "Agencia de Viajes",
        "entities": [
            E("Viaje", "código", "destino", "fecha salida", "fecha regreso", "precio"),
            E("Cliente", "DNI", "nombre", "dirección", "teléfono"),
            E("Guía", "código", "nombre", "idiomas"),
        ],
        "relationships": [
            R("Contratación", "Cliente", "Viaje", "N", "M", ("fecha contratación", "plazas reservadas")),
            R("Guía", "Guía", "Viaje", "1", "N"),
        ],
    },
    {
        "no": 7,
        "title": "Concesionario de Autos",
        "entities": [
            E("Auto", "matrícula", "marca", "modelo", "año", "precio"),
            E("Cliente", "DNI", "nombre", "dirección", "teléfono"),
            E("Marca", "código", "nombre", "país origen"),
        ],
        "relationships": [
            R("Compra", "Cliente", "Auto", "1", "N", ("fecha compra", "precio final")),
            R("Pertenece", "Marca", "Auto", "1", "N"),
        ],
    },
    {
        "no": 8,
        "title": "Sistema de Pedidos",
        "entities": [
            E("Cliente", "código", "nombre", "dirección", "ciudad", "teléfono"),
            E("Pedido", "número pedido", "fecha", "estado"),
            E("Producto", "código", "nombre", "precio unitario", "stock"),
        ],
        "relationships": [
            R("Realiza", "Cliente", "Pedido", "1", "N"),
            R("Línea Pedido", "Pedido", "Producto", "N", "M", ("cantidad", "precio unitario línea")),
        ],
    },
    {
        "no": 9,
        "title": "Escuela de Música",
        "entities": [
            E("Alumno", "código", "nombre", "edad", "instrumento principal"),
            E("Profesor", "código", "nombre", "especialidad", "experiencia"),
            E("Concierto", "código", "fecha", "lugar", "nombre evento"),
        ],
        "relationships": [
            R("Clase", "Alumno", "Profesor", "N", "M", ("día semana", "hora")),
            R("Participa", "Alumno", "Concierto", "N", "M"),
        ],
    },
    {
        "no": 10,
        "title": "Cadena de Restaurantes",
        "entities": [
            E("Restaurante", "código", "nombre", "dirección", "ciudad", "capacidad"),
            E("Camarero", "código", "nombre", "fecha contratación", "turno"),
            E("Cliente", "código", "nombre"),
            E("Pedido", "número", "fecha", "hora", "estado"),
        ],
        "relationships": [
            R("Emplea", "Restaurante", "Camarero", "1", "N"),
            R("Realiza", "Cliente", "Pedido", "1", "N"),
            R("Recibe", "Restaurante", "Pedido", "1", "N"),
            R("Atiende", "Camarero", "Pedido", "1", "N"),
        ],
    },
    {
        "no": 11,
        "title": "Sistema de Facturación",
        "entities": [
            E("Factura", "número", "fecha", "total"),
            E("Cliente", "DNI", "nombre", "dirección", "email"),
            E("Línea Factura", "número línea", "cantidad vendida", "subtotal"),
            E("Producto", "código", "descripción", "precio"),
        ],
        "relationships": [
            R("Corresponde", "Cliente", "Factura", "1", "N"),
            R("Tiene", "Factura", "Línea Factura", "1", "N"),
            R("Producto línea", "Producto", "Línea Factura", "1", "N"),
        ],
    },
    {
        "no": 12,
        "title": "Inmobiliaria",
        "entities": [
            E("Propiedad", "código", "dirección", "tipo", "metros cuadrados", "precio"),
            E("Propietario", "DNI", "nombre", "teléfono", "email"),
            E("Cliente Interesado", "DNI", "nombre", "presupuesto máximo"),
        ],
        "relationships": [
            R("Posee", "Propietario", "Propiedad", "1", "N"),
            R("Visita", "Cliente Interesado", "Propiedad", "N", "M", ("fecha visita", "valoración")),
        ],
    },
    {
        "no": 13,
        "title": "Sistema de Nómina",
        "entities": [
            E("Empleado", "código", "nombre", "fecha contratación", "salario base", "cargo"),
            E("Departamento", "código", "nombre", "ubicación"),
            E("Nómina", "código", "mes", "año", "total devengado"),
        ],
        "relationships": [
            R("Pertenece", "Departamento", "Empleado", "1", "N"),
            R("Recibe", "Empleado", "Nómina", "1", "N"),
        ],
    },
    {
        "no": 14,
        "title": "Videoclub",
        "entities": [
            E("Película", "código", "título", "género", "año", "duración"),
            E("Socio", "número", "nombre", "dirección", "fecha alta"),
        ],
        "relationships": [
            R("Alquiler", "Socio", "Película", "N", "M", ("fecha alquiler", "fecha devolución", "precio alquiler")),
        ],
    },
    {
        "no": 15,
        "title": "Sistema de Citas Médicas",
        "entities": [
            E("Doctor", "código", "nombre", "especialidad", "consultorio"),
            E("Paciente", "historia clínica", "nombre", "fecha nacimiento", "seguro médico"),
        ],
        "relationships": [
            R("Cita", "Paciente", "Doctor", "N", "M", ("fecha", "hora", "motivo", "estado")),
        ],
    },
    {
        "no": 16,
        "title": "Plataforma de Cursos Online",
        "entities": [
            E("Curso", "código", "título", "descripción", "duración", "nivel"),
            E("Instructor", "código", "nombre", "biografía", "email"),
            E("Estudiante", "código", "nombre", "email", "fecha registro"),
        ],
        "relationships": [
            R("Imparte", "Instructor", "Curso", "N", "M"),
            R("Inscripción", "Estudiante", "Curso", "N", "M", ("fecha inscripción", "progreso")),
        ],
    },
    {
        "no": 17,
        "title": "Sistema de Reserva de Vuelos",
        "entities": [
            E("Vuelo", "código", "origen", "destino", "fecha", "hora", "capacidad"),
            E("Pasajero", "DNI", "nombre", "fecha nacimiento", "nacionalidad"),
        ],
        "relationships": [
            R("Reserva", "Pasajero", "Vuelo", "N", "M", ("número asiento", "clase", "precio")),
        ],
    },
    {
        "no": 18,
        "title": "Sistema de Gestión de Proyectos",
        "entities": [
            E("Proyecto", "código", "nombre", "fecha inicio", "fecha fin", "presupuesto"),
            E("Empleado", "código", "nombre", "cargo", "salario"),
        ],
        "relationships": [
            R("Asignación", "Empleado", "Proyecto", "N", "M", ("horas semanales",)),
            R("Jefatura", "Empleado", "Proyecto", "1", "N"),
        ],
    },
    {
        "no": 19,
        "title": "Sistema de Matrícula Universitaria",
        "entities": [
            E("Asignatura", "código", "nombre", "créditos", "curso académico"),
            E("Profesor", "código", "nombre", "departamento", "categoría"),
            E("Alumno", "número expediente", "nombre", "carrera", "año ingreso"),
        ],
        "relationships": [
            R("Imparte", "Profesor", "Asignatura", "N", "M"),
            R("Matrícula", "Alumno", "Asignatura", "N", "M", ("semestre",)),
        ],
    },
    {
        "no": 20,
        "title": "Sistema de Gestión de Incidencias",
        "entities": [
            E("Incidencia", "código", "descripción", "fecha apertura", "prioridad", "estado"),
            E("Cliente", "código", "nombre", "empresa", "teléfono"),
            E("Técnico", "código", "nombre", "especialidad", "nivel"),
        ],
        "relationships": [
            R("Reporta", "Cliente", "Incidencia", "1", "N"),
            R("Asignación", "Técnico", "Incidencia", "N", "M", ("fecha asignación", "fecha cierre")),
        ],
    },
    {
        "no": 21,
        "title": "Sistema de Gestión de Eventos",
        "entities": [
            E("Evento", "código", "nombre", "fecha", "lugar", "aforo"),
            E("Patrocinador", "código", "nombre", "sector", "aportación económica"),
            E("Asistente", "DNI", "nombre", "email"),
        ],
        "relationships": [
            R("Patrocina", "Patrocinador", "Evento", "N", "M"),
            R("Entrada", "Asistente", "Evento", "N", "M", ("fecha compra", "tipo entrada", "precio")),
        ],
    },
    {
        "no": 22,
        "title": "Sistema de Gestión de Almacén",
        "entities": [
            E("Producto", "código", "nombre", "descripción", "stock mínimo"),
            E("Proveedor", "código", "nombre", "dirección", "teléfono"),
            E("Ubicación", "código", "pasillo", "estantería", "nivel"),
        ],
        "relationships": [
            R("Suministro", "Proveedor", "Producto", "N", "M", ("precio compra", "fecha último suministro")),
            R("Almacena", "Ubicación", "Producto", "1", "N"),
        ],
    },
    {
        "no": 23,
        "title": "Sistema de Gestión de Recursos Humanos",
        "entities": [
            E("Empleado", "código", "nombre", "fecha nacimiento", "dirección"),
            E("Contrato", "código", "tipo", "fecha inicio", "fecha fin", "salario", "activo"),
        ],
        "relationships": [
            R("Tiene", "Empleado", "Contrato", "1", "N"),
            R("Reporta a", "Empleado", "Empleado", "1", "N"),
        ],
    },
    {
        "no": 24,
        "title": "Sistema de Gestión de Pedidos de Restaurante",
        "entities": [
            E("Pedido", "número", "fecha", "hora", "tipo"),
            E("Cliente", "teléfono", "nombre", "dirección"),
            E("Plato", "código", "nombre", "precio", "categoría"),
            E("Cocinero", "código", "nombre", "especialidad"),
        ],
        "relationships": [
            R("Realiza", "Cliente", "Pedido", "1", "N"),
            R("Detalle Pedido", "Pedido", "Plato", "N", "M", ("cantidad", "observaciones")),
            R("Prepara", "Cocinero", "Pedido", "N", "M"),
        ],
    },
    {
        "no": 25,
        "title": "Sistema de Gestión de Seguros",
        "entities": [
            E("Póliza", "número", "tipo", "fecha inicio", "fecha fin", "prima"),
            E("Asegurado", "DNI", "nombre", "dirección", "fecha nacimiento"),
            E("Siniestro", "código", "fecha", "descripción", "importe"),
        ],
        "relationships": [
            R("Contrata", "Asegurado", "Póliza", "1", "N"),
            R("Asocia", "Póliza", "Siniestro", "1", "N"),
        ],
    },
    {
        "no": 26,
        "title": "Sistema de Gestión de Transporte Público",
        "entities": [
            E("Línea", "código", "nombre", "origen", "destino", "frecuencia"),
            E("Autobús", "matrícula", "modelo", "capacidad", "fecha alta"),
            E("Conductor", "código", "nombre", "licencia", "fecha contratación"),
        ],
        "relationships": [
            R("Tiene", "Línea", "Autobús", "1", "N"),
            R("Conduce", "Conductor", "Autobús", "N", "M", ("turno",)),
        ],
    },
    {
        "no": 27,
        "title": "Sistema de Gestión de Biblioteca Universitaria",
        "entities": [
            E("Libro", "ISBN", "título", "edición", "año"),
            E("Tema", "código", "nombre", "descripción"),
            E("Usuario", "código", "nombre", "tipo", "facultad"),
        ],
        "relationships": [
            R("Catalogación", "Libro", "Tema", "N", "M"),
            R("Reserva", "Usuario", "Libro", "N", "M", ("fecha reserva", "fecha recogida")),
        ],
    },
    {
        "no": 28,
        "title": "Sistema de Gestión de Farmacia",
        "entities": [
            E("Medicamento", "código", "nombre", "principio activo", "precio", "stock"),
            E("Laboratorio", "código", "nombre", "dirección", "teléfono"),
            E("Cliente", "DNI", "nombre", "mutua"),
        ],
        "relationships": [
            R("Suministro", "Laboratorio", "Medicamento", "N", "M"),
            R("Compra", "Cliente", "Medicamento", "N", "M", ("fecha compra", "cantidad")),
        ],
    },
    {
        "no": 29,
        "title": "Sistema de Gestión de Gimnasio",
        "entities": [
            E("Socio", "código", "nombre", "fecha alta", "tipo cuota"),
            E("Clase", "código", "nombre", "horario", "sala", "capacidad"),
            E("Monitor", "código", "nombre", "especialidad"),
        ],
        "relationships": [
            R("Imparte", "Monitor", "Clase", "1", "N"),
            R("Asistencia", "Socio", "Clase", "N", "M", ("fecha asistencia",)),
        ],
    },
    {
        "no": 30,
        "title": "Sistema de Gestión de Hotel",
        "entities": [
            E("Habitación", "número", "tipo", "capacidad", "precio noche"),
            E("Huésped", "DNI", "nombre", "fecha nacimiento", "nacionalidad"),
        ],
        "relationships": [
            R("Reserva", "Huésped", "Habitación", "N", "M", ("fecha entrada", "fecha salida", "número huéspedes")),
        ],
    },
    {
        "no": 31,
        "title": "Sistema de Gestión de Cine",
        "entities": [
            E("Película", "código", "título", "duración", "género", "clasificación"),
            E("Sala", "número", "capacidad", "tipo pantalla"),
            E("Sesión", "código", "fecha", "hora", "idioma", "precio"),
            E("Espectador", "DNI", "nombre", "email"),
        ],
        "relationships": [
            R("Programa", "Película", "Sesión", "1", "N"),
            R("Proyecta", "Sala", "Sesión", "1", "N"),
            R("Entrada", "Espectador", "Sesión", "N", "M", ("fecha compra", "fila", "asiento")),
        ],
    },
    {
        "no": 32,
        "title": "Sistema de Gestión de Taller Mecánico",
        "entities": [
            E("Vehículo", "matrícula", "marca", "modelo", "año"),
            E("Cliente", "DNI", "nombre", "teléfono", "dirección"),
            E("Reparación", "código", "fecha entrada", "fecha salida", "descripción", "coste"),
            E("Mecánico", "código", "nombre", "especialidad"),
        ],
        "relationships": [
            R("Posee", "Cliente", "Vehículo", "1", "N"),
            R("Registra", "Vehículo", "Reparación", "1", "N"),
            R("Realiza", "Mecánico", "Reparación", "N", "M"),
        ],
    },
    {
        "no": 33,
        "title": "Sistema de Gestión de Órdenes de Compra",
        "entities": [
            E("Orden Compra", "número", "fecha", "estado"),
            E("Proveedor", "código", "nombre", "dirección", "condiciones pago"),
            E("Artículo", "código", "nombre", "descripción"),
        ],
        "relationships": [
            R("Envía", "Proveedor", "Orden Compra", "1", "N"),
            R("Detalle Orden", "Orden Compra", "Artículo", "N", "M", ("cantidad solicitada", "precio unitario negociado", "fecha entrega esperada")),
        ],
    },
    {
        "no": 34,
        "title": "Sistema de Gestión de Elecciones",
        "entities": [
            E("Candidato", "DNI", "nombre", "partido", "biografía"),
            E("Elección", "código", "fecha", "cargo", "ámbito territorial"),
            E("Votante", "DNI", "nombre", "mesa electoral"),
            E("Voto", "código", "hora", "tipo voto"),
        ],
        "relationships": [
            R("Se presenta", "Candidato", "Elección", "N", "M"),
            R("Emite", "Votante", "Voto", "1", "N"),
            R("Para candidato", "Candidato", "Voto", "1", "N"),
            R("En elección", "Elección", "Voto", "1", "N"),
        ],
    },
    {
        "no": 35,
        "title": "Sistema de Gestión de ONG",
        "entities": [
            E("Proyecto Solidario", "código", "nombre", "país destino", "fecha inicio", "presupuesto"),
            E("Voluntario", "código", "nombre", "profesión", "fecha alta"),
        ],
        "relationships": [
            R("Participación", "Voluntario", "Proyecto Solidario", "N", "M", ("fecha incorporación", "rol desempeñado")),
        ],
    },
    {
        "no": 36,
        "title": "Sistema de Gestión de Estación de Servicio",
        "entities": [
            E("Surtidor", "código", "tipo combustible", "capacidad"),
            E("Empleado", "código", "nombre", "turno"),
            E("Vehículo", "matrícula", "cliente"),
            E("Repostaje", "código", "fecha", "hora", "litros", "importe"),
        ],
        "relationships": [
            R("Registra", "Vehículo", "Repostaje", "1", "N"),
            R("Usa", "Surtidor", "Repostaje", "1", "N"),
            R("Atiende", "Empleado", "Repostaje", "1", "N"),
        ],
    },
    {
        "no": 37,
        "title": "Sistema de Gestión de Academia de Idiomas",
        "entities": [
            E("Idioma", "código", "nombre", "nivel dificultad"),
            E("Grupo", "código", "nivel", "horario", "aula"),
            E("Profesor", "código", "nombre", "idioma nativo"),
            E("Alumno", "código", "nombre", "fecha nacimiento", "nivel inicial"),
        ],
        "relationships": [
            R("Ofrece", "Idioma", "Grupo", "1", "N"),
            R("Imparte", "Profesor", "Grupo", "1", "N"),
            R("Matrícula", "Alumno", "Grupo", "N", "M", ("fecha matrícula", "nota final")),
        ],
    },
    {
        "no": 38,
        "title": "Sistema de Gestión de Compañía Aseguradora de Vehículos",
        "entities": [
            E("Póliza Vehículo", "número", "fecha inicio", "fecha fin", "cobertura"),
            E("Vehículo", "matrícula", "marca", "modelo", "año"),
            E("Tomador", "DNI", "nombre", "dirección", "carnet"),
            E("Siniestro", "código", "fecha", "lugar", "descripción", "importe estimado"),
        ],
        "relationships": [
            R("Posee", "Tomador", "Vehículo", "1", "N"),
            R("Contrata", "Tomador", "Póliza Vehículo", "1", "N"),
            R("Cubre", "Vehículo", "Póliza Vehículo", "1", "N"),
            R("Asocia", "Póliza Vehículo", "Siniestro", "1", "N"),
        ],
    },
    {
        "no": 39,
        "title": "Sistema de Gestión de Teatro",
        "entities": [
            E("Obra", "código", "título", "autor", "duración", "género"),
            E("Función", "código", "fecha", "hora", "sala"),
            E("Espectador", "DNI", "nombre", "tipo abono"),
            E("Director", "código", "nombre", "experiencia"),
        ],
        "relationships": [
            R("Representa", "Obra", "Función", "1", "N"),
            R("Entrada", "Espectador", "Función", "N", "M", ("fecha compra", "zona sala", "precio")),
            R("Dirige", "Director", "Obra", "1", "N"),
        ],
    },
    {
        "no": 40,
        "title": "Sistema de Gestión de Consultoría",
        "entities": [
            E("Proyecto", "código", "nombre", "cliente", "presupuesto", "estado"),
            E("Consultor", "código", "nombre", "especialidad", "tarifa horaria"),
        ],
        "relationships": [
            R("Asignación", "Consultor", "Proyecto", "N", "M", ("horas dedicadas", "rol proyecto")),
            R("Dirección", "Consultor", "Proyecto", "1", "N"),
        ],
    },
    {
        "no": 41,
        "title": "Sistema de Gestión de Clínica Veterinaria",
        "entities": [
            E("Mascota", "código", "nombre", "especie", "raza", "fecha nacimiento"),
            E("Dueño", "DNI", "nombre", "dirección", "teléfono"),
            E("Consulta", "código", "fecha", "motivo", "diagnóstico", "tratamiento"),
            E("Veterinario", "código", "nombre", "especialidad"),
        ],
        "relationships": [
            R("Posee", "Dueño", "Mascota", "1", "N"),
            R("Registra", "Mascota", "Consulta", "1", "N"),
            R("Atiende", "Veterinario", "Consulta", "1", "N"),
        ],
    },
    {
        "no": 42,
        "title": "Sistema de Gestión de Editorial",
        "entities": [
            E("Libro", "ISBN", "título", "género", "fecha publicación"),
            E("Autor", "código", "nombre", "nacionalidad", "biografía"),
            E("Editor", "código", "nombre", "departamento"),
        ],
        "relationships": [
            R("Escritura", "Autor", "Libro", "N", "M", ("fecha contrato",)),
            R("Edita", "Editor", "Libro", "1", "N"),
        ],
    },
    {
        "no": 43,
        "title": "Sistema de Gestión de Supermercado",
        "entities": [
            E("Producto", "código", "nombre", "precio", "stock"),
            E("Categoría", "código", "nombre", "pasillo"),
            E("Proveedor", "código", "nombre", "plazo entrega"),
            E("Cliente", "código", "nombre", "tarjeta fidelidad"),
            E("Compra", "código", "fecha", "total", "puntos acumulados"),
        ],
        "relationships": [
            R("Pertenece", "Categoría", "Producto", "1", "N"),
            R("Suministro", "Proveedor", "Producto", "N", "M", ("precio compra", "fecha último pedido")),
            R("Realiza", "Cliente", "Compra", "1", "N"),
            R("Detalle Compra", "Compra", "Producto", "N", "M", ("cantidad", "precio unitario")),
        ],
    },
    {
        "no": 44,
        "title": "Sistema de Gestión de Escuela de Conductores",
        "entities": [
            E("Alumno", "DNI", "nombre", "fecha nacimiento", "tipo carnet solicitado"),
            E("Clase Teórica", "código", "fecha", "hora", "duración", "resultado"),
            E("Clase Práctica", "código", "fecha", "hora", "duración", "resultado"),
            E("Instructor", "código", "nombre", "tipo carnet imparte"),
            E("Examen", "código", "fecha", "tipo", "resultado"),
        ],
        "relationships": [
            R("Recibe teoría", "Alumno", "Clase Teórica", "N", "M"),
            R("Recibe práctica", "Alumno", "Clase Práctica", "1", "N"),
            R("Imparte", "Instructor", "Clase Práctica", "1", "N"),
            R("Se examina", "Alumno", "Examen", "1", "N"),
        ],
    },
    {
        "no": 45,
        "title": "Sistema de Gestión de Peluquería",
        "entities": [
            E("Cliente", "teléfono", "nombre", "preferencias"),
            E("Cita", "código", "fecha", "hora", "servicio", "precio final"),
            E("Peluquero", "código", "nombre", "especialidad"),
            E("Producto Belleza", "código", "nombre", "marca", "stock"),
        ],
        "relationships": [
            R("Solicita", "Cliente", "Cita", "1", "N"),
            R("Atiende", "Peluquero", "Cita", "1", "N"),
            R("Utiliza", "Cita", "Producto Belleza", "N", "M", ("cantidad utilizada",)),
        ],
    },
    {
        "no": 46,
        "title": "Sistema de Gestión de Centro de Formación",
        "entities": [
            E("Curso", "código", "nombre", "horas", "modalidad"),
            E("Formador", "código", "nombre", "área expertise"),
            E("Alumno", "DNI", "nombre", "empresa patrocinadora"),
        ],
        "relationships": [
            R("Imparte", "Formador", "Curso", "N", "M"),
            R("Inscripción", "Alumno", "Curso", "N", "M", ("fecha inscripción", "asistencia", "calificación final")),
        ],
    },
    {
        "no": 47,
        "title": "Sistema de Gestión de Parque de Atracciones",
        "entities": [
            E("Atracción", "código", "nombre", "tipo", "altura mínima", "capacidad"),
            E("Operario", "código", "nombre", "fecha contratación", "turno"),
            E("Visitante", "código", "nombre", "fecha nacimiento", "tipo entrada"),
        ],
        "relationships": [
            R("Opera", "Operario", "Atracción", "N", "M"),
            R("Acceso", "Visitante", "Atracción", "N", "M", ("fecha", "hora", "tiempo espera estimado")),
        ],
    },
    {
        "no": 48,
        "title": "Sistema de Gestión de Flota de Vehículos",
        "entities": [
            E("Vehículo", "matrícula", "marca", "modelo", "fecha compra", "kilometraje"),
            E("Conductor", "DNI", "nombre", "licencia", "categoría"),
            E("Mantenimiento", "código", "fecha", "tipo", "coste", "taller"),
        ],
        "relationships": [
            R("Asignación", "Conductor", "Vehículo", "N", "M", ("turno",)),
            R("Mantenimiento", "Vehículo", "Mantenimiento", "1", "N"),
        ],
    },
    {
        "no": 49,
        "title": "Sistema de Gestión de Tienda de Mascotas",
        "entities": [
            E("Mascota", "código", "especie", "raza", "fecha nacimiento", "precio"),
            E("Criador", "código", "nombre", "dirección", "especialidad"),
            E("Cliente", "DNI", "nombre", "experiencia previa"),
            E("Artículo", "código", "nombre", "categoría", "precio"),
        ],
        "relationships": [
            R("Suministra", "Criador", "Mascota", "1", "N"),
            R("Compra mascota", "Cliente", "Mascota", "1", "N", ("fecha compra", "garantía sanitaria")),
            R("Compra artículo", "Cliente", "Artículo", "N", "M", ("fecha compra", "cantidad")),
        ],
    },
    {
        "no": 50,
        "title": "Sistema de Gestión de Centro Médico Especializado",
        "entities": [
            E("Especialidad", "código", "nombre", "descripción"),
            E("Especialista", "código", "nombre", "número colegiado", "años experiencia"),
            E("Paciente", "historia clínica", "nombre", "fecha nacimiento", "mutua"),
            E("Derivación", "código", "fecha", "motivo"),
        ],
        "relationships": [
            R("Tiene", "Especialidad", "Especialista", "1", "N"),
            R("Cita", "Paciente", "Especialista", "N", "M", ("fecha", "hora", "motivo", "diagnóstico", "tratamiento prescrito")),
            R("Solicita", "Paciente", "Derivación", "1", "N"),
            R("Origen", "Especialidad", "Derivación", "1", "N"),
            R("Destino", "Especialidad", "Derivación", "1", "N"),
        ],
    },
]


class Scene:
    def __init__(self) -> None:
        self.elements: list[dict] = []
        self._n = 0
        random.seed(42)

    def _id(self) -> str:
        self._n += 1
        return f"er{self._n:06d}"

    def base(self, typ: str, x: float, y: float, w: float, h: float, **extra) -> dict:
        el = {
            "id": self._id(),
            "type": typ,
            "x": round(x, 2),
            "y": round(y, 2),
            "width": round(w, 2),
            "height": round(h, 2),
            "angle": 0,
            "strokeColor": extra.pop("strokeColor", "#1e1e1e"),
            "backgroundColor": extra.pop("backgroundColor", "transparent"),
            "fillStyle": "solid",
            "strokeWidth": extra.pop("strokeWidth", 1),
            "strokeStyle": "solid",
            "roughness": extra.pop("roughness", 0.8),
            "opacity": 100,
            "groupIds": extra.pop("groupIds", []),
            "frameId": None,
            "seed": random.randint(1, 2_000_000_000),
            "version": 1,
            "versionNonce": random.randint(1, 2_000_000_000),
            "isDeleted": False,
            "boundElements": [],
            "updated": int(time.time() * 1000),
            "link": None,
            "locked": False,
        }
        el.update(extra)
        self.elements.append(el)
        return el

    def rect(self, x, y, w, h, **kw):
        kw.setdefault("roundness", {"type": 3})
        return self.base("rectangle", x, y, w, h, **kw)

    def ellipse(self, x, y, w, h, **kw):
        return self.base("ellipse", x, y, w, h, **kw)

    def diamond(self, x, y, w, h, **kw):
        return self.base("diamond", x, y, w, h, **kw)

    def line(self, x1, y1, x2, y2, **kw):
        return self.base(
            "line",
            x1,
            y1,
            x2 - x1,
            y2 - y1,
            points=[[0, 0], [round(x2 - x1, 2), round(y2 - y1, 2)]],
            startBinding=None,
            endBinding=None,
            lastCommittedPoint=None,
            startArrowhead=None,
            endArrowhead=None,
            **kw,
        )

    def text(self, x, y, text, size=20, color="#1e1e1e", align="left", w=None, bold=False):
        lines = text.split("\n")
        if w is None:
            w = max(20, max(len(line) for line in lines) * size * 0.56)
        h = len(lines) * size * 1.25
        return self.base(
            "text",
            x,
            y,
            w,
            h,
            strokeColor=color,
            backgroundColor="transparent",
            fillStyle="solid",
            strokeWidth=1,
            roughness=0,
            text=text,
            fontSize=size,
            fontFamily=1,
            textAlign=align,
            verticalAlign="middle",
            baseline=round(h * 0.78, 2),
            containerId=None,
            originalText=text,
            lineHeight=1.25,
        )


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in s).strip("_")


def is_many(card: str) -> bool:
    return card.upper() in {"N", "M", "*", "0..N", "1..N"}


def center(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x + w / 2, y + h / 2


def edge_point(box: tuple[float, float, float, float], other: tuple[float, float]) -> tuple[float, float]:
    x, y, w, h = box
    cx, cy = center(box)
    ox, oy = other
    dx, dy = ox - cx, oy - cy
    if dx == 0 and dy == 0:
        return cx, cy
    scale_x = (w / 2) / abs(dx) if dx else float("inf")
    scale_y = (h / 2) / abs(dy) if dy else float("inf")
    t = min(scale_x, scale_y)
    return cx + dx * t, cy + dy * t


def add_label_box(scene: Scene, x, y, w, h, label, fill, stroke="#1e1e1e", size=20):
    scene.rect(x, y, w, h, backgroundColor=fill, strokeColor=stroke, roughness=0.7)
    scene.text(x + 8, y + (h - size * 1.25) / 2, label, size=size, align="center", w=w - 16)


def layout_positions(names: list[str], x: float, y: float, w: float, h: float) -> dict[str, tuple[float, float]]:
    n = len(names)
    cx, cy = x + w / 2, y + h / 2 + 40
    if n == 1:
        return {names[0]: (cx, cy)}
    rx = min(w * 0.33, 520)
    ry = min(h * 0.28, 360)
    start = -math.pi / 2
    out = {}
    for i, name in enumerate(names):
        ang = start + 2 * math.pi * i / n
        out[name] = (cx + rx * math.cos(ang), cy + ry * math.sin(ang))
    return out


def draw_chen(scene: Scene, model: dict, x: float, y: float, w: float, h: float) -> None:
    scene.text(x + 20, y + 20, "Notación Chen", size=26, color="#14532d")
    names = [e["name"] for e in model["entities"]]
    pos = layout_positions(names, x + 20, y + 80, w - 40, h - 120)
    boxes: dict[str, tuple[float, float, float, float]] = {}
    entity_map = {e["name"]: e for e in model["entities"]}
    cx, cy = x + w / 2, y + h / 2

    for ent in model["entities"]:
        name = ent["name"]
        ex, ey = pos[name]
        ew = max(170, len(name) * 12 + 45)
        eh = 58
        box = (ex - ew / 2, ey - eh / 2, ew, eh)
        boxes[name] = box
        scene.rect(*box, backgroundColor="#dcfce7", strokeColor="#166534", strokeWidth=2)
        scene.text(box[0], box[1] + 14, name, size=21, align="center", w=ew)

        attrs = [("PK " + ent["pk"], True)] + [(a, False) for a in ent["attrs"]]
        vx, vy = ex - cx, ey - cy
        length = math.hypot(vx, vy) or 1
        ux, uy = vx / length, vy / length
        px, py = -uy, ux
        columns = 2 if len(attrs) > 4 else 1
        for idx, (attr, primary) in enumerate(attrs):
            col = idx % columns
            row = idx // columns
            aw = min(210, max(96, len(attr) * 9 + 28))
            ah = 36
            outward = 118 + row * 44
            sideways = (col - (columns - 1) / 2) * 170
            ax = ex + ux * outward + px * sideways - aw / 2
            ay = ey + uy * outward + py * sideways - ah / 2
            fill = "#fef3c7" if primary else "#f8fafc"
            stroke = "#b45309" if primary else "#64748b"
            scene.line(ex, ey, ax + aw / 2, ay + ah / 2, strokeColor="#94a3b8")
            scene.ellipse(ax, ay, aw, ah, backgroundColor=fill, strokeColor=stroke)
            scene.text(ax + 4, ay + 8, attr, size=14, align="center", w=aw - 8)

    pair_counts: dict[tuple[str, str], int] = {}
    for rel in model["relationships"]:
        a, b = rel["a"], rel["b"]
        a_box = boxes[a]
        if a == b:
            bx, by, bw, bh = a_box
            dx, dy = bx + bw + 160, by - 50
            scene.diamond(dx, dy, 150, 86, backgroundColor="#e0f2fe", strokeColor="#0369a1", strokeWidth=2)
            scene.text(dx + 6, dy + 29, rel["name"], size=16, align="center", w=138)
            scene.line(bx + bw, by + 12, dx, dy + 24, strokeColor="#334155")
            scene.line(bx + bw, by + bh - 12, dx, dy + 64, strokeColor="#334155")
            scene.text((bx + bw + dx) / 2 - 8, (by + dy) / 2, rel["ca"], size=15)
            scene.text((bx + bw + dx) / 2 - 8, (by + bh + dy + 64) / 2, rel["cb"], size=15)
            continue

        b_box = boxes[b]
        key = tuple(sorted((a, b)))
        idx = pair_counts.get(key, 0)
        pair_counts[key] = idx + 1
        acx, acy = center(a_box)
        bcx, bcy = center(b_box)
        mx, my = (acx + bcx) / 2, (acy + bcy) / 2
        dxv, dyv = bcx - acx, bcy - acy
        dist = math.hypot(dxv, dyv) or 1
        off = (idx - 0.5) * 90 if idx else 0
        mx += -dyv / dist * off
        my += dxv / dist * off
        dw, dh = max(140, len(rel["name"]) * 11 + 38), 78
        dbox = (mx - dw / 2, my - dh / 2, dw, dh)
        scene.diamond(*dbox, backgroundColor="#e0f2fe", strokeColor="#0369a1", strokeWidth=2)
        scene.text(dbox[0] + 8, dbox[1] + 26, rel["name"], size=16, align="center", w=dw - 16)
        p1 = edge_point(a_box, (mx, my))
        p2 = edge_point(b_box, (mx, my))
        scene.line(p1[0], p1[1], dbox[0] + dw * 0.15, my, strokeColor="#334155")
        scene.line(dbox[0] + dw * 0.85, my, p2[0], p2[1], strokeColor="#334155")
        scene.text((p1[0] + mx) / 2 - 18, (p1[1] + my) / 2 - 24, rel["ca"], size=16)
        scene.text((p2[0] + mx) / 2 + 6, (p2[1] + my) / 2 - 24, rel["cb"], size=16)

        for i, attr in enumerate(rel["attrs"]):
            aw = min(220, max(110, len(attr) * 8 + 30))
            ah = 34
            ax = mx - aw / 2 + (i - (len(rel["attrs"]) - 1) / 2) * 150
            ay = my + dh / 2 + 34
            scene.line(mx, my + dh / 2, ax + aw / 2, ay, strokeColor="#94a3b8")
            scene.ellipse(ax, ay, aw, ah, backgroundColor="#eff6ff", strokeColor="#2563eb")
            scene.text(ax + 4, ay + 8, attr, size=13, align="center", w=aw - 8)


def association_entities(model: dict) -> tuple[list[dict], list[dict]]:
    ents = [dict(e) for e in model["entities"]]
    rels = []
    entity_map = {e["name"]: e for e in ents}
    used = {e["name"] for e in ents}

    for rel in model["relationships"]:
        if is_many(rel["ca"]) and is_many(rel["cb"]):
            base = rel["name"]
            name = base
            if name in used:
                name = f"{base} Asoc."
            used.add(name)
            a_ent, b_ent = entity_map[rel["a"]], entity_map[rel["b"]]
            assoc = E(
                name,
                f"{slug(rel['a'])}_{slug(a_ent['pk'])} + {slug(rel['b'])}_{slug(b_ent['pk'])}",
                f"FK {rel['a']}.{a_ent['pk']}",
                f"FK {rel['b']}.{b_ent['pk']}",
                *rel["attrs"],
            )
            ents.append(assoc)
            entity_map[name] = assoc
            rels.append(R(rel["name"], rel["a"], name, "1", "N"))
            rels.append(R(rel["name"], rel["b"], name, "1", "N"))
        else:
            rels.append(rel)
    return ents, rels


def draw_table_entity(scene: Scene, ent: dict, x: float, y: float) -> tuple[float, float, float, float]:
    lines = [ent["name"], f"PK {ent['pk']}"] + ent["attrs"]
    width = max(230, min(320, max(len(line) for line in lines) * 8.2 + 28))
    height = 38 + (len(lines) - 1) * 24 + 18
    scene.rect(x, y, width, height, backgroundColor="#fff7ed", strokeColor="#9a3412", strokeWidth=2)
    scene.rect(x, y, width, 36, backgroundColor="#fed7aa", strokeColor="#9a3412", strokeWidth=2)
    scene.text(x + 8, y + 7, ent["name"], size=17, align="center", w=width - 16)
    for i, line in enumerate(lines[1:]):
        color = "#7c2d12" if i == 0 else "#334155"
        scene.text(x + 12, y + 44 + i * 24, line, size=14, color=color, w=width - 24)
    return x, y, width, height


def marker(scene: Scene, x: float, y: float, toward: tuple[float, float], many: bool) -> None:
    tx, ty = toward
    vx, vy = tx - x, ty - y
    length = math.hypot(vx, vy) or 1
    ux, uy = vx / length, vy / length
    px, py = -uy, ux
    if many:
        base_x, base_y = x + ux * 24, y + uy * 24
        for mul in (-1, 0, 1):
            scene.line(base_x, base_y, x + px * 12 * mul, y + py * 12 * mul, strokeColor="#334155", strokeWidth=2)
    else:
        cx, cy = x + ux * 14, y + uy * 14
        scene.line(cx - px * 12, cy - py * 12, cx + px * 12, cy + py * 12, strokeColor="#334155", strokeWidth=2)


def draw_crow(scene: Scene, model: dict, x: float, y: float, w: float, h: float) -> None:
    scene.text(x + 20, y + 20, "Pata de gallo", size=26, color="#9a3412")
    entities, rels = association_entities(model)
    names = [e["name"] for e in entities]
    pos = layout_positions(names, x + 20, y + 80, w - 40, h - 120)
    boxes: dict[str, tuple[float, float, float, float]] = {}
    for ent in entities:
        px, py = pos[ent["name"]]
        temp_lines = [ent["name"], f"PK {ent['pk']}"] + ent["attrs"]
        bw = max(230, min(320, max(len(line) for line in temp_lines) * 8.2 + 28))
        bh = 38 + (len(temp_lines) - 1) * 24 + 18
        boxes[ent["name"]] = draw_table_entity(scene, ent, px - bw / 2, py - bh / 2)

    pair_counts: dict[tuple[str, str], int] = {}
    for rel in rels:
        a, b = rel["a"], rel["b"]
        a_box, b_box = boxes[a], boxes[b]
        if a == b:
            bx, by, bw, bh = a_box
            x1, y1 = bx + bw, by + bh * 0.35
            x2, y2 = bx + bw + 120, by + bh * 0.35
            x3, y3 = bx + bw + 120, by + bh * 0.75
            x4, y4 = bx + bw, by + bh * 0.75
            scene.line(x1, y1, x2, y2, strokeColor="#334155")
            scene.line(x2, y2, x3, y3, strokeColor="#334155")
            scene.line(x3, y3, x4, y4, strokeColor="#334155")
            scene.text(x2 + 8, (y2 + y3) / 2 - 12, f"{rel['name']} 1:N", size=14)
            continue

        key = tuple(sorted((a, b)))
        idx = pair_counts.get(key, 0)
        pair_counts[key] = idx + 1
        ac = center(a_box)
        bc = center(b_box)
        p1 = edge_point(a_box, bc)
        p2 = edge_point(b_box, ac)
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        dist = math.hypot(dx, dy) or 1
        off = (idx - 0.5) * 52 if idx else 0
        px, py = -dy / dist, dx / dist
        q1 = (p1[0] + px * off, p1[1] + py * off)
        q2 = (p2[0] + px * off, p2[1] + py * off)
        scene.line(q1[0], q1[1], q2[0], q2[1], strokeColor="#334155")
        marker(scene, q1[0], q1[1], q2, is_many(rel["ca"]))
        marker(scene, q2[0], q2[1], q1, is_many(rel["cb"]))
        mx, my = (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2
        scene.text(mx - 70, my - 20, rel["name"], size=14, align="center", w=140, color="#475569")
        if rel["attrs"] and not (is_many(rel["ca"]) and is_many(rel["cb"])):
            scene.text(mx - 95, my + 4, "attrs: " + ", ".join(rel["attrs"]), size=12, align="center", w=190, color="#64748b")


def draw_legend(scene: Scene) -> None:
    x, y, w, h = 40, 40, 3400, 440
    scene.rect(x, y, w, h, backgroundColor="#f8fafc", strokeColor="#334155", strokeWidth=2)
    scene.text(x + 30, y + 28, "50 ejercicios ER: Chen + Pata de gallo", size=34, color="#0f172a")
    scene.text(
        x + 30,
        y + 88,
        "Cada recuadro contiene dos versiones del mismo ejercicio. En Chen se usan rectángulos para entidades, rombos para relaciones y óvalos para atributos. En pata de gallo, las relaciones N:M se resolvieron como entidades asociativas cuando corresponde.",
        size=20,
        color="#334155",
        w=w - 60,
    )
    add_label_box(scene, x + 60, y + 180, 190, 58, "Entidad", "#dcfce7", "#166534", 20)
    scene.diamond(x + 330, y + 170, 170, 78, backgroundColor="#e0f2fe", strokeColor="#0369a1", strokeWidth=2)
    scene.text(x + 348, y + 197, "Relación", size=18, align="center", w=134)
    scene.ellipse(x + 585, y + 184, 180, 44, backgroundColor="#fef3c7", strokeColor="#b45309")
    scene.text(x + 598, y + 197, "PK atributo", size=16, align="center", w=154)
    draw_table_entity(scene, E("Tabla", "id", "atributo", "FK otra.id"), x + 860, y + 160)
    scene.line(x + 1250, y + 205, x + 1480, y + 205, strokeColor="#334155")
    marker(scene, x + 1250, y + 205, (x + 1480, y + 205), False)
    marker(scene, x + 1480, y + 205, (x + 1250, y + 205), True)
    scene.text(x + 1280, y + 228, "1:N", size=18, color="#475569")
    scene.text(
        x + 30,
        y + 330,
        "Nota: en algunos enunciados faltan atributos de entidades como Cliente o Pedido; se agregó un identificador mínimo para que el diagrama sea usable.",
        size=18,
        color="#64748b",
        w=w - 60,
    )


def main() -> None:
    scene = Scene()
    draw_legend(scene)
    frame_w, frame_h = 3600, 1700
    margin_x, margin_y = 90, 90
    start_y = 560
    cols = 2

    for idx, model in enumerate(MODELS):
        col = idx % cols
        row = idx // cols
        fx = 40 + col * (frame_w + margin_x)
        fy = start_y + row * (frame_h + margin_y)
        scene.rect(fx, fy, frame_w, frame_h, backgroundColor="#ffffff", strokeColor="#cbd5e1", strokeWidth=2)
        scene.text(fx + 28, fy + 24, f"Ejercicio {model['no']}: {model['title']}", size=30, color="#0f172a")
        mid = fx + frame_w / 2
        scene.line(mid, fy + 82, mid, fy + frame_h - 36, strokeColor="#e2e8f0", strokeWidth=2)
        draw_chen(scene, model, fx + 20, fy + 78, frame_w / 2 - 40, frame_h - 100)
        draw_crow(scene, model, mid + 20, fy + 78, frame_w / 2 - 40, frame_h - 100)

    payload = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": scene.elements,
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": "#f8fafc",
            "currentItemFontFamily": 1,
        },
        "files": {},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT.resolve()} with {len(scene.elements)} elements")


if __name__ == "__main__":
    main()
