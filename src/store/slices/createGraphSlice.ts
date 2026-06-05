import {
  computeGraphData,
  type ExplicitNoteRelation,
  type GraphComputeMode,
  type NoteGraphData,
} from '../../features/notes-graph/graph'
import type { NoteRelation, SliceCreator } from '../types'
import type { AppNode } from '../../types/workspace'

interface GraphSliceDeps {
  emptyGraph: NoteGraphData
  toExplicitRelations: (relations: NoteRelation[]) => ExplicitNoteRelation[]
}

export const createGraphSlice = (deps: GraphSliceDeps): SliceCreator<{
  graphData: NoteGraphData
  graphComputeMode: GraphComputeMode
  refreshGraph: (nodesOverride?: AppNode[], relationsOverride?: NoteRelation[]) => Promise<void>
}> => (set, get) => ({
  graphData: deps.emptyGraph,
  graphComputeMode: 'rust',
  refreshGraph: async (nodesOverride, relationsOverride) => {
    const nodes = nodesOverride ?? get().nodes
    const relations = relationsOverride ?? get().noteRelations
    const preferredMode = get().graphComputeMode
    const { graph, mode } = await computeGraphData(
      nodes,
      preferredMode,
      deps.toExplicitRelations(relations),
    )

    set({
      graphData: graph,
      graphComputeMode: mode,
    })
  },
})

